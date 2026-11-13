import {
  buildIssueCreateApiRequest,
  buildIssueCreateUrl,
  buildIssueListUrl,
  addPullRequestIssueReferences,
  updateAnalysisIssueReferences,
} from './lib/issue-map.js';

const GITHUB_ISSUE_TYPE = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};
const ISSUE_MAP_CACHE_PREFIX = 'issueMapData:';
const ISSUE_MAP_CACHE_TTL_MS = 5 * 60 * 1000;
const issueMapDataRequests = new Map();

function isValidRepoSegment(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9._-]+$/.test(value)
    && value !== '.'
    && value !== '..';
}

async function getGitHubPat() {
  const { githubPat } = await chrome.storage.session.get('githubPat');
  if (typeof githubPat !== 'string' || !githubPat) {
    throw new Error('Configure a fine-grained PAT in the extension options');
  }
  return githubPat;
}

function getIssueMapCacheKey(owner, repo) {
  return `${ISSUE_MAP_CACHE_PREFIX}${owner}/${repo}`;
}

async function storeIssueMapDataCache(key, data) {
  try {
    await chrome.storage.session.set({
      [key]: {
        data,
        expiresAt: Date.now() + ISSUE_MAP_CACHE_TTL_MS,
      },
    });
  } catch (error) {
    console.error('Could not save the temporary Issue Map cache', error);
  }
}

async function updateCachedIssueMapData(owner, repo, updater) {
  const key = getIssueMapCacheKey(owner, repo);
  const cached = (await chrome.storage.session.get(key))[key];
  if (!cached?.data) {
    return;
  }
  const data = updater(cached.data);
  await storeIssueMapDataCache(key, data);
}

async function cacheCreatedIssue(owner, repo, issueType, issue) {
  await updateCachedIssueMapData(owner, repo, (data) => {
    const target = issueType === GITHUB_ISSUE_TYPE.ANALYSIS_RESULT
      ? 'analysisIssues'
      : 'countermeasureIssues';
    const issues = (data[target] || []).filter((item) => item.number !== issue.number);
    issues.push(issue);
    return { ...data, [target]: issues };
  });
}

async function updateCachedIssue(owner, repo, issueNumber, issue) {
  await updateCachedIssueMapData(owner, repo, (data) => {
    const existing = [
      ...(data.analysisIssues || []),
      ...(data.countermeasureIssues || []),
    ].find((item) => item.number === issueNumber);
    const updatedIssue = { ...existing, ...issue };
    const hasLabel = (label) => updatedIssue.labels?.some(
      (issueLabel) => issueLabel.name?.toLowerCase() === label
    );
    const analysisIssues = (data.analysisIssues || [])
      .filter((item) => item.number !== issueNumber);
    const countermeasureIssues = (data.countermeasureIssues || [])
      .filter((item) => item.number !== issueNumber);
    if (hasLabel(GITHUB_ISSUE_TYPE.ANALYSIS_RESULT)) {
      analysisIssues.push(updatedIssue);
    }
    if (hasLabel(GITHUB_ISSUE_TYPE.COUNTERMEASURE)) {
      countermeasureIssues.push(updatedIssue);
    }
    return { analysisIssues, countermeasureIssues };
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'session' || !changes.githubPat) {
    return;
  }
  chrome.storage.session.get(null)
    .then((items) => Object.keys(items)
      .filter((key) => key.startsWith(ISSUE_MAP_CACHE_PREFIX)))
    .then((keys) => (keys.length > 0 ? chrome.storage.session.remove(keys) : undefined))
    .catch((error) => console.error('Could not clear the Issue Map cache', error));
});

async function fetchGitHubApi(url, githubPat) {
  const apiUrl = new URL(url);
  if (apiUrl.origin !== 'https://api.github.com') {
    throw new Error('The GitHub API destination is invalid');
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
    throw new Error(`GitHub API returned an invalid response (${response.status})`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('The PAT is invalid or expired. Configure a new PAT.');
    }
    if (response.status === 403) {
      throw new Error('The PAT requires repository access, Issues: Read and write, and Pull requests: Read and write permissions');
    }
    throw new Error(data.message || `GitHub API error (${response.status})`);
  }
  return { data, expiration: response.headers.get('github-authentication-token-expiration') };
}

async function fetchGitHubGraphQL(query, variables, githubPat) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubPat}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ query, variables }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`GitHub GraphQL returned an invalid response (${response.status})`);
  }
  if (!response.ok || result.errors?.length) {
    throw new Error(result.errors?.map((error) => error.message).join('; ')
      || `GitHub GraphQL error (${response.status})`);
  }
  return result.data;
}

async function fetchAllPages(url, githubPat) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const pagedUrl = new URL(url);
    pagedUrl.searchParams.set('per_page', '100');
    pagedUrl.searchParams.set('page', String(page));
    const { data } = await fetchGitHubApi(pagedUrl, githubPat);
    if (!Array.isArray(data)) {
      throw new Error('GitHub API returned an invalid list');
    }
    items.push(...data);
    if (data.length < 100) {
      return items;
    }
  }
}

async function fetchRepositoryIssues(owner, repo, githubPat) {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`
    );
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

async function fetchRepositoryPullRequests(owner, repo, githubPat) {
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`
  );
  url.searchParams.set('state', 'all');
  return fetchAllPages(url, githubPat);
}

async function fetchIssueMapData(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)) {
    throw new Error('Repository information is invalid');
  }
  const cacheKey = getIssueMapCacheKey(message.owner, message.repo);
  const cached = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (cached?.expiresAt > Date.now() && Array.isArray(cached.data.pullRequests)) {
    return cached.data;
  }
  const pendingRequest = issueMapDataRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }
  const request = fetchFreshIssueMapData(message)
    .then(async (data) => {
      await storeIssueMapDataCache(cacheKey, data);
      return data;
    })
    .finally(() => issueMapDataRequests.delete(cacheKey));
  issueMapDataRequests.set(cacheKey, request);
  return request;
}

async function fetchFreshIssueMapData(message) {
  const githubPat = await getGitHubPat();
  const issues = await fetchRepositoryIssues(message.owner, message.repo, githubPat);
  const pullRequests = await fetchRepositoryPullRequests(message.owner, message.repo, githubPat);
  const hasLabel = (issue, label) => Array.isArray(issue.labels) && issue.labels.some(
    (issueLabel) => typeof issueLabel.name === 'string' && issueLabel.name.toLowerCase() === label
  );
  const analysisIssues = issues.filter((issue) => hasLabel(issue, GITHUB_ISSUE_TYPE.ANALYSIS_RESULT));
  const countermeasureIssues = issues.filter((issue) => hasLabel(issue, GITHUB_ISSUE_TYPE.COUNTERMEASURE));
  return { analysisIssues, countermeasureIssues, pullRequests };
}

async function fetchPullRequests(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)) {
    throw new Error('Repository information is invalid');
  }
  const githubPat = await getGitHubPat();
  return fetchRepositoryPullRequests(message.owner, message.repo, githubPat);
}

async function fetchIssueDetails(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)
    || !Number.isInteger(message.issueNumber) || message.issueNumber < 1) {
    throw new Error('Issue information is invalid');
  }
  const githubPat = await getGitHubPat();
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(message.owner)}/${encodeURIComponent(message.repo)}`;
  const [issueResult, labels, assignees, milestones, events] = await Promise.all([
    fetchGitHubApi(`${baseUrl}/issues/${message.issueNumber}`, githubPat),
    fetchAllPages(`${baseUrl}/labels`, githubPat),
    fetchAllPages(`${baseUrl}/assignees`, githubPat),
    fetchAllPages(`${baseUrl}/milestones?state=all`, githubPat),
    fetchAllPages(`${baseUrl}/issues/${message.issueNumber}/timeline`, githubPat),
  ]);
  const issue = issueResult.data;
  let projectData = null;
  let projectError = null;
  try {
    projectData = await fetchGitHubGraphQL(
      `query($owner: String!, $repo: String!, $issueId: ID!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 100) {
            nodes { id title url closed }
          }
        }
        node(id: $issueId) {
          ... on Issue {
            projectItems(first: 100) {
              nodes { id project { id title url } }
            }
          }
        }
      }`,
      { owner: message.owner, repo: message.repo, issueId: issue.node_id },
      githubPat
    );
  } catch (error) {
    projectError = error.message;
  }
  return {
    issue,
    labels: labels.map(({ id, name, color }) => ({ id, name, color })),
    assignees: assignees.map(({ login, avatar_url }) => ({ login, avatar_url })),
    milestones: milestones.map(({ number, title, state }) => ({ number, title, state })),
    projects: projectData?.repository?.projectsV2?.nodes || [],
    projectItems: projectData?.node?.projectItems?.nodes || [],
    projectError,
    events: events.reverse(),
  };
}

async function updateIssueDetails(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)
    || !Number.isInteger(message.issueNumber) || message.issueNumber < 1) {
    throw new Error('Issue information is invalid');
  }
  if (typeof message.title !== 'string' || !message.title.trim() || message.title.length > 256
    || typeof message.body !== 'string'
    || !Array.isArray(message.labels) || !Array.isArray(message.assignees)
    || (message.projectIds !== null && !Array.isArray(message.projectIds))
    || (message.milestone !== null && !Number.isInteger(message.milestone))) {
    throw new Error('The issue update data is invalid');
  }
  const githubPat = await getGitHubPat();
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(message.owner)}/${encodeURIComponent(message.repo)}`;
  const issueResponse = await fetch(`${baseUrl}/issues/${message.issueNumber}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubPat}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: message.title.trim(),
      body: message.body,
      labels: message.labels,
      assignees: message.assignees,
      milestone: message.milestone,
    }),
  });
  let issue;
  try {
    issue = await issueResponse.json();
  } catch {
    throw new Error(`GitHub API returned an invalid response (${issueResponse.status})`);
  }
  if (!issueResponse.ok) {
    throw new Error(issue.message || `Could not update the issue (${issueResponse.status})`);
  }
  await updateCachedIssue(message.owner, message.repo, message.issueNumber, issue);

  if (message.projectIds === null) {
    return { issueUrl: issue.html_url, projectsUpdated: false };
  }

  try {
    const data = await fetchGitHubGraphQL(
      `query($issueId: ID!) {
        node(id: $issueId) {
          ... on Issue {
            projectItems(first: 100) {
              nodes { id project { id } }
            }
          }
        }
      }`,
      { issueId: issue.node_id },
      githubPat
    );
    if (!data?.node || !Array.isArray(data.node.projectItems?.nodes)) {
      throw new Error('Could not retrieve the issue Projects v2 data');
    }
    const currentItems = data.node.projectItems.nodes
      .filter((item) => item.project?.id);
    const currentProjectIds = new Set(currentItems.map((item) => item.project.id));
    const desiredProjectIds = new Set(message.projectIds);
    const mutations = [];
    for (const item of currentItems) {
      if (!desiredProjectIds.has(item.project.id)) {
        mutations.push(fetchGitHubGraphQL(
          `mutation($projectId: ID!, $itemId: ID!) {
            deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
              deletedItemId
            }
          }`,
          { projectId: item.project.id, itemId: item.id },
          githubPat
        ));
      }
    }
    for (const projectId of desiredProjectIds) {
      if (!currentProjectIds.has(projectId)) {
        mutations.push(fetchGitHubGraphQL(
          `mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
              item { id }
            }
          }`,
          { projectId, contentId: issue.node_id },
          githubPat
        ));
      }
    }
    await Promise.all(mutations);
  } catch (error) {
    throw new Error(`The issue title, body, and other fields were saved, but Projects v2 could not be updated: ${error.message}`);
  }
  return { issueUrl: issue.html_url };
}

async function linkCountermeasureIssues(message) {
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)
    || !Number.isInteger(message.analysisIssueNumber) || message.analysisIssueNumber < 1
    || !Array.isArray(message.countermeasureIssueNumbers)
    || message.countermeasureIssueNumbers.length === 0
    || message.countermeasureIssueNumbers.some((number) => !Number.isInteger(number) || number < 1)) {
    throw new Error('The issue linking data is invalid');
  }
  const countermeasureIssueNumbers = [...new Set(message.countermeasureIssueNumbers)];
  const githubPat = await getGitHubPat();
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(message.owner)}/${encodeURIComponent(message.repo)}/issues`;
  const { data: analysisIssue } = await fetchGitHubApi(
    `${baseUrl}/${message.analysisIssueNumber}`,
    githubPat
  );
  if (analysisIssue.pull_request || !analysisIssue.labels?.some(
    (label) => label.name?.toLowerCase() === GITHUB_ISSUE_TYPE.ANALYSIS_RESULT
  )) {
    throw new Error(`Issue #${message.analysisIssueNumber} is not an analysis result`);
  }

  const linkedIssueNumbers = [];
  for (const issueNumber of countermeasureIssueNumbers) {
    try {
      const { data: issue } = await fetchGitHubApi(`${baseUrl}/${issueNumber}`, githubPat);
      if (issue.pull_request || !issue.labels?.some(
        (label) => label.name?.toLowerCase() === GITHUB_ISSUE_TYPE.COUNTERMEASURE
      )) {
        throw new Error(`Issue #${issueNumber} is not a countermeasure`);
      }

      const body = updateAnalysisIssueReferences(issue.body || '', [message.analysisIssueNumber]);
      let updatedIssue = issue;
      if (body !== (issue.body || '')) {
        const response = await fetch(`${baseUrl}/${issueNumber}`, {
          method: 'PATCH',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${githubPat}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ body }),
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error(`GitHub API returned an invalid response (${response.status})`);
        }
        if (!response.ok) {
          throw new Error(result.message || `Could not update issue #${issueNumber} (${response.status})`);
        }
        updatedIssue = result;
      }
      await updateCachedIssue(message.owner, message.repo, issueNumber, updatedIssue);
      linkedIssueNumbers.push(issueNumber);
    } catch (error) {
      if (linkedIssueNumbers.length > 0) {
        throw new Error(
          `Some links were saved (#${linkedIssueNumbers.join(', #')}). Failed on issue #${issueNumber}: ${error.message}`
        );
      }
      throw error;
    }
  }
  return { linkedIssueNumbers, analysisIssueNumber: message.analysisIssueNumber };
}

async function linkPullRequestIssues(message) {
  const validNumbers = (numbers) => Array.isArray(numbers)
    && numbers.length > 0
    && numbers.every((number) => Number.isInteger(number) && number > 0);
  if (!isValidRepoSegment(message.owner) || !isValidRepoSegment(message.repo)
    || !Number.isInteger(message.pullRequestNumber) || message.pullRequestNumber < 1
    || !validNumbers(message.analysisIssueNumbers)
    || !validNumbers(message.countermeasureIssueNumbers)) {
    throw new Error('The pull request linking data is invalid');
  }

  const analysisIssueNumbers = [...new Set(message.analysisIssueNumbers)];
  const countermeasureIssueNumbers = [...new Set(message.countermeasureIssueNumbers)];
  const githubPat = await getGitHubPat();
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(message.owner)}/${encodeURIComponent(message.repo)}`;
  const [{ data: pullRequest }, analysisResults, countermeasures] = await Promise.all([
    fetchGitHubApi(`${baseUrl}/pulls/${message.pullRequestNumber}`, githubPat),
    Promise.all(analysisIssueNumbers.map(async (issueNumber) => {
      const { data: issue } = await fetchGitHubApi(`${baseUrl}/issues/${issueNumber}`, githubPat);
      if (issue.pull_request || !issue.labels?.some(
        (label) => label.name?.toLowerCase() === GITHUB_ISSUE_TYPE.ANALYSIS_RESULT
      )) {
        throw new Error(`Issue #${issueNumber} is not an analysis result`);
      }
      return issue;
    })),
    Promise.all(countermeasureIssueNumbers.map(async (issueNumber) => {
      const { data: issue } = await fetchGitHubApi(`${baseUrl}/issues/${issueNumber}`, githubPat);
      if (issue.pull_request || !issue.labels?.some(
        (label) => label.name?.toLowerCase() === GITHUB_ISSUE_TYPE.COUNTERMEASURE
      )) {
        throw new Error(`Issue #${issueNumber} is not a countermeasure`);
      }
      return issue;
    })),
  ]);
  if (!pullRequest.pull_request && !pullRequest.html_url) {
    throw new Error(`Issue #${message.pullRequestNumber} is not a pull request`);
  }

  const issueNumbers = [...analysisResults, ...countermeasures].map((issue) => issue.number);
  const body = addPullRequestIssueReferences(pullRequest.body || '', issueNumbers, {
    owner: message.owner,
    repo: message.repo,
  });
  let updatedPullRequest = pullRequest;
  if (body !== (pullRequest.body || '')) {
    const response = await fetch(`${baseUrl}/pulls/${message.pullRequestNumber}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubPat}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ body }),
    });
    try {
      updatedPullRequest = await response.json();
    } catch {
      throw new Error(`GitHub API returned an invalid response (${response.status})`);
    }
    if (!response.ok) {
      throw new Error(updatedPullRequest.message || `Could not update pull request #${message.pullRequestNumber} (${response.status})`);
    }
  }
  await updateCachedIssueMapData(message.owner, message.repo, (data) => ({
    ...data,
    pullRequests: [
      ...(data.pullRequests || []).filter((item) => item.number !== updatedPullRequest.number),
      updatedPullRequest,
    ],
  }));
  return {
    pullRequestNumber: updatedPullRequest.number,
    linkedAnalysisIssueNumbers: analysisIssueNumbers,
    linkedCountermeasureIssueNumbers: countermeasureIssueNumbers,
  };
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
    throw new Error('Repository information is invalid');
  }
  if (message.issueType !== GITHUB_ISSUE_TYPE.ANALYSIS_RESULT
    && message.issueType !== GITHUB_ISSUE_TYPE.COUNTERMEASURE) {
    throw new Error('The issue type is invalid');
  }
  if (typeof message.title !== 'string' || !message.title.trim()) {
    throw new Error('Enter an issue title');
  }
  if (typeof message.body !== 'string') {
    throw new Error('The issue body is invalid');
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
    throw new Error(`GitHub API returned an invalid response (${response.status})`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('The PAT is invalid or expired. Configure a new PAT.');
    }
    if (response.status === 403) {
      throw new Error('The PAT requires Issues: Read and write permission for the repository');
    }
    throw new Error(result.message || `GitHub API error (${response.status})`);
  }
  if (typeof result.html_url !== 'string' || !Number.isInteger(result.number)) {
    throw new Error('The GitHub API response did not contain issue data');
  }
  await cacheCreatedIssue(message.owner, message.repo, message.issueType, result);
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

  if (message.type === 'FETCH_REPOSITORY_PULL_REQUESTS') {
    fetchPullRequests(message)
      .then((pullRequests) => sendResponse({ ok: true, pullRequests }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'FETCH_ISSUE_DETAILS') {
    fetchIssueDetails(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'UPDATE_ISSUE_DETAILS') {
    updateIssueDetails(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'LINK_COUNTERMEASURE_ISSUES') {
    linkCountermeasureIssues(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'LINK_PULL_REQUEST_ISSUES') {
    linkPullRequestIssues(message)
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
        expired: error.message.includes('invalid or expired'),
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
