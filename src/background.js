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

async function getGitHubPat() {
  const { githubPat } = await chrome.storage.session.get('githubPat');
  if (typeof githubPat !== 'string' || !githubPat) {
    throw new Error('拡張機能のオプションでFine-grained PATを設定してください');
  }
  return githubPat;
}

async function fetchGitHubApi(url, githubPat) {
  const apiUrl = new URL(url);
  if (apiUrl.origin !== 'https://api.github.com') {
    throw new Error('GitHub APIの送信先が不正です');
  }
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubPat}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`GitHub APIから有効な応答がありませんでした (${response.status})`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('PATが無効または期限切れです。新しいPATを設定してください');
    }
    if (response.status === 403) {
      throw new Error('PATに対象リポジトリへのアクセスとIssues: Read and write権限が必要です');
    }
    throw new Error(data.message || `GitHub APIエラー (${response.status})`);
  }
  return { data, expiration: response.headers.get('github-authentication-token-expiration') };
}

async function fetchLabeledIssues(owner, repo, label, githubPat) {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`
    );
    url.searchParams.set('labels', label);
    url.searchParams.set('state', 'all');
    url.searchParams.set('sort', 'created');
    url.searchParams.set('direction', 'asc');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));

    const { data } = await fetchGitHubApi(url, githubPat);
    if (!Array.isArray(data)) {
      throw new Error('GitHub API returned an invalid issue list');
    }
    issues.push(...data.filter((issue) => !issue.pull_request));
    if (data.length < 100) {
      return issues;
    }
  }
}

async function getLinkedPullRequest(issue, owner, repo, githubPat) {
  const timelineUrl = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue.number}/timeline`
  );
  timelineUrl.searchParams.set('per_page', '100');
  const { data: events } = await fetchGitHubApi(timelineUrl, githubPat);
  if (!Array.isArray(events)) {
    throw new Error(`GitHub API returned an invalid timeline for issue #${issue.number}`);
  }

  const linkedPullRequests = events
    .filter((event) => event.event === 'cross-referenced')
    .map((event) => event.source?.issue || event.source)
    .filter((source) => source?.pull_request?.url);

  if (linkedPullRequests.length === 0) {
    return { ...issue, countermeasureStatus: '未着手' };
  }

  const pullRequests = await Promise.all(
    linkedPullRequests.map(async (source) => {
      const { data } = await fetchGitHubApi(source.pull_request.url, githubPat);
      return data;
    })
  );
  return {
    ...issue,
    countermeasureStatus: pullRequests.some((pullRequest) => pullRequest.merged_at)
      ? '完了'
      : '未完了',
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchIssueMapData(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)) {
    throw new Error('リポジトリ情報が不正です');
  }
  const githubPat = await getGitHubPat();
  const [analysisIssues, rawCountermeasureIssues] = await Promise.all([
    fetchLabeledIssues(message.owner, message.repo, GITHUB_ISSUE_TYPE.ANALYSIS_RESULT, githubPat),
    fetchLabeledIssues(message.owner, message.repo, GITHUB_ISSUE_TYPE.COUNTERMEASURE, githubPat),
  ]);
  const countermeasureIssues = await mapWithConcurrency(
    rawCountermeasureIssues,
    4,
    (issue) => getLinkedPullRequest(issue, message.owner, message.repo, githubPat)
  );
  return { analysisIssues, countermeasureIssues };
}

async function checkGitHubPat() {
  const { githubPat } = await chrome.storage.session.get('githubPat');
  if (typeof githubPat !== 'string' || !githubPat) {
    return { configured: false };
  }

  const { data, expiration } = await fetchGitHubApi(
    'https://api.github.com/user',
    githubPat
  );
  return {
    configured: true,
    valid: true,
    username: data.login,
    expiration,
  };
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

  const githubPat = await getGitHubPat();

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

  if (message.type === 'FETCH_ISSUE_MAP_DATA') {
    fetchIssueMapData(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'CHECK_GITHUB_PAT') {
    checkGitHubPat()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({
        ok: true,
        configured: true,
        valid: false,
        expired: error.message.includes('無効または期限切れ'),
        error: error.message,
      }));
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
