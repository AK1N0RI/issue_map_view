const GITHUB_ISSUE_TYPE = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};

function buildIssueCreateUrl({ owner, repo, type }) {
  const label = type === GITHUB_ISSUE_TYPE.COUNTERMEASURE ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues/new`);
  url.searchParams.set('labels', label);
  return url.toString();
}

function buildIssueListUrl({ owner, repo, type }) {
  const label = type === GITHUB_ISSUE_TYPE.COUNTERMEASURE ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues`);
  url.searchParams.set('q', `label:"${label}"`);
  return url.toString();
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
