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
      resolve({ owner: match[1], repo: match[2], tabId: activeTab.id });
    });
  });
}

async function openIssueCreate(type) {
  const repoContext = await getCurrentRepoContext();
  if (!repoContext) {
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(repoContext.tabId, {
      type: 'OPEN_ISSUE_CREATE_DRAWER',
      issueType: type,
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    document.getElementById('issue-create-status').textContent =
      `Could not open the creation form: ${error.message}`;
  }
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

document.getElementById('open-extension-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage().catch((error) => {
    document.getElementById('pat-status').textContent =
      `Could not open extension settings: ${error.message}`;
  });
});
