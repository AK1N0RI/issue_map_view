const ISSUE_TYPES = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};

function getCurrentRepoContext() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      const url = activeTab?.url || '';
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
      if (!match) {
        resolve(null);
        return;
      }
      resolve({ owner: match[1], repo: match[2] });
    });
  });
}

async function openIssueCreate(type) {
  const repoContext = await getCurrentRepoContext();
  if (!repoContext) {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'OPEN_ISSUE_CREATE',
    ...repoContext,
    issueType: type,
  });
}

async function openIssueList(type) {
  const repoContext = await getCurrentRepoContext();
  if (!repoContext) {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'OPEN_ISSUE_LIST',
    ...repoContext,
    issueType: type,
  });
}

document.getElementById('new-analysis-result').addEventListener('click', () => {
  openIssueCreate(ISSUE_TYPES.ANALYSIS_RESULT);
});

document.getElementById('new-countermeasure').addEventListener('click', () => {
  openIssueCreate(ISSUE_TYPES.COUNTERMEASURE);
});

document.getElementById('link-analysis-result').addEventListener('click', () => {
  openIssueList(ISSUE_TYPES.ANALYSIS_RESULT);
});

document.getElementById('link-countermeasure').addEventListener('click', () => {
  openIssueList(ISSUE_TYPES.COUNTERMEASURE);
});
