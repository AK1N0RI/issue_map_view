import {
  buildIssueCreateApiRequest,
  buildIssueCreateUrl,
  buildIssueListUrl,
} from './lib/issue-map.js';

const GITHUB_ISSUE_TYPE = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};

function isValidRepoSegment(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9._-]+$/.test(value)
    && value !== '.'
    && value !== '..';
}

async function createIssue(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)) {
    throw new Error('リポジトリ情報が不正です');
  }
  if (message.issueType !== GITHUB_ISSUE_TYPE.ANALYSIS_RESULT
    && message.issueType !== GITHUB_ISSUE_TYPE.COUNTERMEASURE) {
    throw new Error('Issueの種類が不正です');
  }
  if (typeof message.title !== 'string' || !message.title.trim()) {
    throw new Error('Issueのタイトルを入力してください');
  }
  if (typeof message.body !== 'string') {
    throw new Error('Issueの本文が不正です');
  }

  const { githubPat } = await chrome.storage.session.get('githubPat');
  if (typeof githubPat !== 'string' || !githubPat) {
    throw new Error('拡張機能ポップアップでFine-grained PATを設定してください');
  }

  const request = buildIssueCreateApiRequest({
    owner: message.owner,
    repo: message.repo,
    type: message.issueType,
    title: message.title,
    body: message.body,
  });
  const response = await fetch(request.url, {
    method: request.method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubPat}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(request.payload),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`GitHub APIから有効な応答がありませんでした (${response.status})`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('PATが無効または期限切れです。新しいPATを設定してください');
    }
    if (response.status === 403) {
      throw new Error('PATに対象リポジトリのIssues: Read and write権限が必要です');
    }
    throw new Error(result.message || `GitHub APIエラー (${response.status})`);
  }
  if (typeof result.html_url !== 'string' || !Number.isInteger(result.number)) {
    throw new Error('GitHub APIの応答にIssue情報がありません');
  }
  return { issueUrl: result.html_url, issueNumber: result.number };
}

function openIssuePage(type, owner, repo) {
  const url = type === GITHUB_ISSUE_TYPE.COUNTERMEASURE
    ? buildIssueListUrl({ owner, repo, type: GITHUB_ISSUE_TYPE.COUNTERMEASURE })
    : buildIssueListUrl({ owner, repo, type: GITHUB_ISSUE_TYPE.ANALYSIS_RESULT });
  return chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'OPEN_ISSUE_CREATE') {
    const url = buildIssueCreateUrl({
      owner: message.owner,
      repo: message.repo,
      type: message.issueType,
    });
    chrome.tabs.create({ url });
    sendResponse({ ok: true, url });
    return true;
  }

  if (message.type === 'CREATE_GITHUB_ISSUE') {
    createIssue(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'OPEN_ISSUE_LIST') {
    const url = buildIssueListUrl({
      owner: message.owner,
      repo: message.repo,
      type: message.issueType,
    });
    chrome.tabs.create({ url });
    sendResponse({ ok: true, url });
    return true;
  }

  if (message.type === 'OPEN_ISSUES_MAP') {
    const owner = message.owner;
    const repo = message.repo;
    const url = `https://github.com/${owner}/${repo}`;
    chrome.tabs.create({ url, active: true });
    sendResponse({ ok: true, url });
    return true;
  }

  if (message.type === 'OPEN_REPO_ISSUE_PAGE') {
    const issuePage = openIssuePage(message.issueType, message.owner, message.repo);
    sendResponse({ ok: true, tabId: issuePage?.id ?? null });
    return true;
  }

  return false;
});

if (typeof globalThis !== 'undefined') {
  globalThis.__issueMapUtil = {
    GITHUB_ISSUE_TYPE,
    buildIssueCreateUrl,
    buildIssueListUrl,
  };
}
