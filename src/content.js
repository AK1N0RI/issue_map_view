const ISSUE_MAP_TYPES = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};

const ISSUE_MAP_MENU_ID = 'issue-map-menu-button';
const ISSUE_MAP_TABLE_ID = 'issue-map-view-table';
const ISSUE_MAP_ROUTE_HASH = '#issue-map-view';
const issueMapUtilities = import(chrome.runtime.getURL('lib/issue-map.js'));
const ISSUE_MAP_MENU_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" style="margin-right: 6px;">
    <path fill="currentColor" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Zm1.5-.5a.5.5 0 0 0-.5.5v9c0 .28.22.5.5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9ZM4 5h8v1H4V5Zm0 3h8v1H4V8Zm0 3h5v1H4v-1Z"/>
  </svg>
`;

let issueMapPageState = null;
let activeIssueCreateDrawer = null;

function getRepositoryContext() {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function buildIssueCreateUrl({ owner, repo, type }) {
  const label = type === ISSUE_MAP_TYPES.COUNTERMEASURE ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues/new`);
  url.searchParams.set('labels', label);
  return url.toString();
}

function buildIssueListUrl({ owner, repo, type }) {
  const label = type === ISSUE_MAP_TYPES.COUNTERMEASURE ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues`);
  url.searchParams.set('q', `label:"${label}"`);
  return url.toString();
}

function closeIssueCreateDrawer() {
  if (!activeIssueCreateDrawer) {
    return;
  }

  const { backdrop, previousOverflow, returnFocus } = activeIssueCreateDrawer;
  backdrop.remove();
  document.body.style.overflow = previousOverflow;
  activeIssueCreateDrawer = null;
  if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
    returnFocus.focus();
  }
}

async function submitIssueCreateForm(form, repoContext, type, content, submitButton, statusMessage) {
  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  const body = String(formData.get('body') || '');
  if (!title) {
    form.querySelector('[name="title"]')?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Creating...';
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_GITHUB_ISSUE',
      owner: repoContext.owner,
      repo: repoContext.repo,
      issueType: type,
      title,
      body,
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'Could not create the issue through the GitHub API');
    }

    const successMessage = document.createElement('p');
    successMessage.textContent = 'Issue created.';
    successMessage.setAttribute('role', 'status');
    const issueLink = document.createElement('a');
    issueLink.href = response.issueUrl;
    issueLink.textContent = 'View the created issue';
    issueLink.target = '_blank';
    issueLink.rel = 'noopener noreferrer';
    content.replaceChildren(successMessage, issueLink);
    issueMapPageState?.page.loadIssues();
  } catch (error) {
    statusMessage.textContent = `Could not create the issue: ${error.message}`;
    submitButton.disabled = false;
    submitButton.textContent = 'Create issue';
  }
}

function renderIssueCreateForm(content, utilities, repoContext, type, relatedAnalysisIssue) {
  const form = document.createElement('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  titleLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'title';
  titleInput.required = true;
  titleInput.maxLength = 256;
  titleInput.className = 'form-control';
  titleInput.setAttribute('aria-label', 'Issue title');
  titleLabel.appendChild(titleInput);

  const bodyLabel = document.createElement('label');
  bodyLabel.textContent = 'Body';
  bodyLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
  const bodyInput = document.createElement('textarea');
  bodyInput.name = 'body';
  bodyInput.rows = 18;
  bodyInput.className = 'form-control';
  bodyInput.setAttribute('aria-label', 'Issue body');
  const defaultBody = new URL(utilities.buildIssueCreateUrl({ ...repoContext, type }))
    .searchParams.get('body') || '';
  bodyInput.value = type === ISSUE_MAP_TYPES.COUNTERMEASURE && relatedAnalysisIssue
    ? utilities.addAnalysisIssueReference(defaultBody, relatedAnalysisIssue.number)
    : defaultBody;
  bodyLabel.appendChild(bodyInput);

  const labelMessage = document.createElement('p');
  labelMessage.textContent = `Label to apply: ${type}`;
  labelMessage.className = 'text-small color-fg-muted';
  labelMessage.style.margin = '0';
  const statusMessage = document.createElement('p');
  statusMessage.setAttribute('role', 'status');
  statusMessage.setAttribute('aria-live', 'polite');
  statusMessage.style.color = 'var(--fgColor-danger, #cf222e)';
  statusMessage.style.margin = '0';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Create issue';
  submitButton.className = 'btn btn-primary';
  submitButton.style.cssText = 'align-self: flex-start;';
  form.append(titleLabel, bodyLabel, labelMessage, statusMessage, submitButton);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitIssueCreateForm(form, repoContext, type, content, submitButton, statusMessage);
  });
  content.replaceChildren(form);
  titleInput.focus();
}

async function openIssueCreateDrawer(type, relatedAnalysisIssue = null) {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    throw new Error('Issues can only be created from a repository page');
  }

  closeIssueCreateDrawer();
  const utilities = await issueMapUtilities;
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 9999; display: flex; justify-content: flex-end; background: rgba(31, 35, 40, 0.24);';
  const drawer = document.createElement('section');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', type === ISSUE_MAP_TYPES.COUNTERMEASURE ? 'Create a countermeasure' : 'Create an analysis result');
  drawer.style.cssText = 'display: flex; flex-direction: column; width: min(640px, 100vw); height: 100%; overflow: hidden; color: var(--fgColor-default, #1f2328); background: var(--bgColor-default, #fff); box-shadow: -8px 0 24px rgba(31, 35, 40, 0.2);';

  const header = document.createElement('header');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--borderColor-default, #d1d9e0);';
  const title = document.createElement('h2');
  title.textContent = type === ISSUE_MAP_TYPES.COUNTERMEASURE ? 'Create a countermeasure' : 'Create an analysis result';
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.className = 'btn btn-sm';
  closeButton.setAttribute('aria-label', 'Close the creation drawer');
  header.append(title, closeButton);

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; overflow: auto; padding: 16px;';
  drawer.append(header, content);
  backdrop.appendChild(drawer);

  const previousOverflow = document.body.style.overflow;
  activeIssueCreateDrawer = {
    backdrop,
    previousOverflow,
    returnFocus: document.activeElement,
  };
  document.body.style.overflow = 'hidden';
  document.body.appendChild(backdrop);

  closeButton.addEventListener('click', closeIssueCreateDrawer);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeIssueCreateDrawer();
    }
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeIssueCreateDrawer();
    }
  });
  closeButton.focus();
  renderIssueCreateForm(content, utilities, repoContext, type, relatedAnalysisIssue);
}

async function openIssueLinkDrawer(repoContext, relatedAnalysisIssue = null) {
  closeIssueCreateDrawer();
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 9999; display: flex; justify-content: flex-end; background: rgba(31, 35, 40, 0.24);';
  const drawer = document.createElement('section');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Link countermeasures to an analysis result');
  drawer.style.cssText = 'display: flex; flex-direction: column; width: min(640px, 100vw); height: 100%; overflow: hidden; color: var(--fgColor-default, #1f2328); background: var(--bgColor-default, #fff); box-shadow: -8px 0 24px rgba(31, 35, 40, 0.2);';

  const header = document.createElement('header');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--borderColor-default, #d1d9e0);';
  const title = document.createElement('h2');
  title.textContent = 'Link countermeasures';
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.className = 'btn btn-sm';
  header.append(title, closeButton);

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; overflow: auto; padding: 16px;';
  const loadingMessage = document.createElement('p');
  loadingMessage.textContent = 'Loading countermeasures...';
  loadingMessage.setAttribute('role', 'status');
  content.appendChild(loadingMessage);
  drawer.append(header, content);
  backdrop.appendChild(drawer);

  const previousOverflow = document.body.style.overflow;
  activeIssueCreateDrawer = { backdrop, previousOverflow, returnFocus: document.activeElement };
  document.body.style.overflow = 'hidden';
  document.body.appendChild(backdrop);
  closeButton.addEventListener('click', closeIssueCreateDrawer);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeIssueCreateDrawer();
    }
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeIssueCreateDrawer();
    }
  });
  closeButton.focus();

  try {
    const [utilities, issueData] = await Promise.all([
      issueMapUtilities,
      fetchIssueMapData(repoContext),
    ]);
    const analysisIssues = issueData.analysisIssues || [];
    const countermeasureIssues = issueData.countermeasureIssues || [];

    const form = document.createElement('form');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    const analysisLabel = document.createElement('label');
    analysisLabel.textContent = 'Analysis result to link';
    analysisLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
    const analysisSelect = document.createElement('select');
    analysisSelect.className = 'form-control';
    analysisSelect.setAttribute('aria-label', 'Analysis result to link');
    if (analysisIssues.length === 0) {
      const emptyAnalysisOption = document.createElement('option');
      emptyAnalysisOption.value = '';
      emptyAnalysisOption.textContent = 'No analysis results available';
      emptyAnalysisOption.selected = true;
      analysisSelect.appendChild(emptyAnalysisOption);
      analysisSelect.disabled = true;
    }
    for (const analysisIssue of analysisIssues) {
      const option = document.createElement('option');
      option.value = String(analysisIssue.number);
      option.textContent = `#${analysisIssue.number} ${analysisIssue.title}`;
      option.selected = analysisIssue.number === relatedAnalysisIssue?.number;
      analysisSelect.appendChild(option);
    }
    if (relatedAnalysisIssue
      && !analysisIssues.some((analysisIssue) => analysisIssue.number === relatedAnalysisIssue.number)) {
      const option = document.createElement('option');
      option.value = String(relatedAnalysisIssue.number);
      option.textContent = `#${relatedAnalysisIssue.number} ${relatedAnalysisIssue.title}`;
      option.selected = true;
      analysisSelect.appendChild(option);
    }
    analysisLabel.appendChild(analysisSelect);

    const linkButton = document.createElement('button');
    linkButton.type = 'submit';
    linkButton.textContent = 'Link selected countermeasures';
    linkButton.className = 'btn btn-primary';
    linkButton.style.cssText = 'align-self: flex-start;';
    linkButton.disabled = analysisIssues.length === 0;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const countermeasureList = document.createElement('div');
    countermeasureList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    if (countermeasureIssues.length === 0) {
      const emptyCountermeasures = document.createElement('p');
      emptyCountermeasures.textContent = 'No issues with the "countermeasure" label were found.';
      emptyCountermeasures.className = 'text-small color-fg-muted';
      countermeasureList.appendChild(emptyCountermeasures);
      linkButton.disabled = true;
    } else {
      for (const issue of countermeasureIssues) {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px; font-weight: 400;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'countermeasureIssue';
        checkbox.value = String(issue.number);
        checkbox.setAttribute('aria-label', `Countermeasure #${issue.number} ${issue.title}`);
        const description = document.createElement('span');
        const issueTitle = document.createElement('span');
        issueTitle.textContent = `#${issue.number} ${issue.title}`;
        issueTitle.style.fontWeight = '600';
        const currentReferences = utilities.getAnalysisIssueNumbers(issue.body)
          .map((number) => `#${number}`).join(', ');
        const existingLinks = document.createElement('small');
        existingLinks.className = 'color-fg-muted';
        existingLinks.textContent = currentReferences
          ? `Current links: ${currentReferences}`
          : 'Current links: None';
        description.append(issueTitle, document.createElement('br'), existingLinks);
        label.append(checkbox, description);
        countermeasureList.appendChild(label);
      }
    }
    form.append(analysisLabel, linkButton, status, countermeasureList);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selectedIssueNumbers = [...form.querySelectorAll('input[name="countermeasureIssue"]:checked')]
        .map((input) => Number(input.value));
      if (selectedIssueNumbers.length === 0) {
        status.textContent = 'Select at least one countermeasure to link.';
        return;
      }
      if (!analysisSelect.value) {
        status.textContent = 'Select an analysis result to link.';
        return;
      }
      linkButton.disabled = true;
      status.textContent = 'Saving links...';
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'LINK_COUNTERMEASURE_ISSUES',
          ...repoContext,
          analysisIssueNumber: Number(analysisSelect.value),
          countermeasureIssueNumbers: selectedIssueNumbers,
        });
        if (!response?.ok) {
          throw new Error(response?.error || 'Could not save the issue links');
        }
        status.textContent = `Linked countermeasure #${response.linkedIssueNumbers.join(', #')} to analysis result #${response.analysisIssueNumber}.`;
        issueMapPageState?.page.loadIssues();
      } catch (error) {
        status.textContent = `Could not link the issues: ${error.message}`;
      } finally {
        linkButton.disabled = false;
      }
    });
    content.replaceChildren(form);
  } catch (error) {
    const errorMessage = document.createElement('p');
    errorMessage.textContent = `Could not display countermeasures: ${error.message}`;
    errorMessage.setAttribute('role', 'alert');
    content.replaceChildren(errorMessage);
  }
}

async function openIssueDetailsDrawer(issue) {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    throw new Error('Issue details can only be viewed from a repository page');
  }
  closeIssueCreateDrawer();

  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 9999; display: flex; justify-content: flex-end; background: rgba(31, 35, 40, 0.24);';
  const drawer = document.createElement('section');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', `Issue #${issue.number} details`);
  drawer.style.cssText = 'display: flex; flex-direction: column; width: min(720px, 100vw); height: 100%; overflow: hidden; color: var(--fgColor-default, #1f2328); background: var(--bgColor-default, #fff); box-shadow: -8px 0 24px rgba(31, 35, 40, 0.2);';

  const header = document.createElement('header');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--borderColor-default, #d1d9e0);';
  const title = document.createElement('h2');
  title.textContent = `Issue #${issue.number}`;
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.className = 'btn btn-sm';
  header.append(title, closeButton);

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; overflow: auto; padding: 16px;';
  const loadingMessage = document.createElement('p');
  loadingMessage.textContent = 'Loading issue details...';
  loadingMessage.setAttribute('role', 'status');
  content.appendChild(loadingMessage);
  drawer.append(header, content);
  backdrop.appendChild(drawer);

  const previousOverflow = document.body.style.overflow;
  activeIssueCreateDrawer = { backdrop, previousOverflow, returnFocus: document.activeElement };
  document.body.style.overflow = 'hidden';
  document.body.appendChild(backdrop);
  closeButton.addEventListener('click', closeIssueCreateDrawer);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeIssueCreateDrawer();
    }
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeIssueCreateDrawer();
    }
  });
  closeButton.focus();

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'FETCH_ISSUE_DETAILS',
      ...repoContext,
      issueNumber: issue.number,
    });
    if (!result?.ok) {
      throw new Error(result?.error || 'Could not retrieve issue details');
    }

    const form = document.createElement('form');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Title';
    titleLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = result.issue.title;
    titleInput.required = true;
    titleInput.maxLength = 256;
    titleInput.className = 'form-control';
    titleInput.setAttribute('aria-label', 'Issue title');
    titleLabel.appendChild(titleInput);

    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = 'Body';
    bodyLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
    const bodyInput = document.createElement('textarea');
    bodyInput.value = result.issue.body || '';
    bodyInput.rows = 14;
    bodyInput.className = 'form-control';
    bodyInput.setAttribute('aria-label', 'Issue body');
    bodyLabel.appendChild(bodyInput);

    const createMultiSelect = (labelText, values, selectedValues, getValue, getLabel) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
      const select = document.createElement('select');
      select.multiple = true;
      select.size = Math.min(Math.max(values.length, 2), 8);
      select.className = 'form-control';
      select.setAttribute('aria-label', labelText);
      for (const value of values) {
        const option = document.createElement('option');
        option.value = getValue(value);
        option.textContent = getLabel(value);
        option.selected = selectedValues.includes(option.value);
        select.appendChild(option);
      }
      label.appendChild(select);
      return select;
    };

    const labelsSelect = createMultiSelect(
      'Labels',
      result.labels,
      result.issue.labels.map((label) => label.name),
      (label) => label.name,
      (label) => label.name
    );
    const assigneeSelect = createMultiSelect(
      'Assignee',
      result.assignees,
      result.issue.assignees.map((assignee) => assignee.login),
      (assignee) => assignee.login,
      (assignee) => assignee.login
    );
    const milestoneLabel = document.createElement('label');
    milestoneLabel.textContent = 'Milestone';
    milestoneLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
    const milestoneSelect = document.createElement('select');
    milestoneSelect.className = 'form-control';
    milestoneSelect.setAttribute('aria-label', 'Milestone');
    const noMilestone = document.createElement('option');
    noMilestone.value = '';
    noMilestone.textContent = 'None';
    milestoneSelect.appendChild(noMilestone);
    for (const milestone of result.milestones) {
      const option = document.createElement('option');
      option.value = String(milestone.number);
      option.textContent = `${milestone.title}${milestone.state === 'closed' ? ' (closed)' : ''}`;
      milestoneSelect.appendChild(option);
    }
    if (result.issue.milestone
      && !result.milestones.some((milestone) => milestone.number === result.issue.milestone.number)) {
      const option = document.createElement('option');
      option.value = String(result.issue.milestone.number);
      option.textContent = result.issue.milestone.title;
      milestoneSelect.appendChild(option);
    }
    milestoneSelect.value = result.issue.milestone ? String(result.issue.milestone.number) : '';
    milestoneLabel.appendChild(milestoneSelect);

    const projectItems = result.projectItems
      .map((item) => item.project)
      .filter((project) => project?.id);
    const projectById = new Map(
      [...result.projects, ...projectItems].map((project) => [project.id, project])
    );
    const projects = [...projectById.values()];
    const projectSelect = createMultiSelect(
      'Projects v2',
      projects,
      projectItems.map((project) => project.id),
      (project) => project.id,
      (project) => `${project.title}${project.closed ? ' (closed)' : ''}`
    );
    if (result.projectError) {
      projectSelect.disabled = true;
      const projectWarning = document.createElement('p');
      projectWarning.textContent = `Could not load Projects v2. Check that the PAT has Projects: Read and write permission. (${result.projectError})`;
      projectWarning.setAttribute('role', 'status');
      projectWarning.style.cssText = 'color: var(--fgColor-danger, #cf222e);';
      form.appendChild(projectWarning);
    }
    if (projects.length === 0) {
      const noProjects = document.createElement('p');
      noProjects.textContent = 'No Projects v2 are available for this repository.';
      noProjects.className = 'text-small color-fg-muted';
      form.appendChild(noProjects);
    }

    const saveStatus = document.createElement('p');
    saveStatus.setAttribute('role', 'status');
    saveStatus.setAttribute('aria-live', 'polite');
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.textContent = 'Save changes';
    saveButton.className = 'btn btn-primary';
    saveButton.style.cssText = 'align-self: flex-start;';
    form.append(titleLabel, bodyLabel, labelsSelect, assigneeSelect, milestoneLabel, projectSelect, saveStatus, saveButton);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!titleInput.value.trim()) {
        saveStatus.textContent = 'Enter a title.';
        titleInput.focus();
        return;
      }
      saveButton.disabled = true;
      saveStatus.textContent = 'Saving...';
      try {
        const updateResult = await chrome.runtime.sendMessage({
          type: 'UPDATE_ISSUE_DETAILS',
          ...repoContext,
          issueNumber: result.issue.number,
          title: titleInput.value.trim(),
          body: bodyInput.value,
          labels: [...labelsSelect.selectedOptions].map((option) => option.value),
          assignees: [...assigneeSelect.selectedOptions].map((option) => option.value),
          milestone: milestoneSelect.value ? Number(milestoneSelect.value) : null,
          projectIds: result.projectError
            ? null
            : [...projectSelect.selectedOptions].map((option) => option.value),
        });
        if (!updateResult?.ok) {
          throw new Error(updateResult?.error || 'Could not update the issue');
        }
        saveStatus.textContent = 'Changes saved. Refreshing the Issue Map.';
        issueMapPageState?.page.loadIssues();
      } catch (error) {
        saveStatus.textContent = `Could not save changes: ${error.message}`;
      } finally {
        saveButton.disabled = false;
      }
    });

    const historyHeading = document.createElement('h3');
    historyHeading.textContent = 'Change history';
    const historyList = document.createElement('ol');
    historyList.style.cssText = 'padding-left: 24px;';
    for (const event of result.events) {
      const item = document.createElement('li');
      const actor = event.actor?.login || 'Unknown user';
      const eventLabel = {
        labeled: 'Added label',
        unlabeled: 'Removed label',
        assigned: 'Assigned user',
        unassigned: 'Unassigned user',
        milestoned: 'Set milestone',
        demilestoned: 'Removed milestone',
        closed: 'Closed issue',
        reopened: 'Reopened issue',
        'cross-referenced': 'Referenced related issue or pull request',
        project_v2_item: 'Updated Projects v2',
      }[event.event] || event.event;
      const date = event.created_at ? new Date(event.created_at).toLocaleString('en-US') : '';
      const detail = event.label?.name || event.assignee?.login || event.milestone?.title || '';
      const changes = event.changes
        ? Object.entries(event.changes)
          .map(([key, value]) => {
            const previous = value?.from;
            const next = value?.to;
            if (previous !== undefined || next !== undefined) {
              return `${key}: ${previous ?? 'None'} → ${next ?? 'None'}`;
            }
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join(', ')
        : '';
      const description = [detail, changes].filter(Boolean).join('; ');
      item.textContent = `${date} ${actor}: ${eventLabel}${description ? ` (${description})` : ''}`;
      historyList.appendChild(item);
    }
    if (result.events.length === 0) {
      const emptyHistory = document.createElement('li');
      emptyHistory.textContent = 'No change history.';
      historyList.appendChild(emptyHistory);
    }
    content.replaceChildren(form, historyHeading, historyList);
  } catch (error) {
    const errorMessage = document.createElement('p');
    errorMessage.textContent = `Could not display issue details: ${error.message}`;
    errorMessage.setAttribute('role', 'alert');
    content.replaceChildren(errorMessage);
  }
}

function getRepoNavigation() {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    return null;
  }

  const repositoryPath = `/${repoContext.owner}/${repoContext.repo}`;
  const candidates = document.querySelectorAll([
    'nav[aria-label="Repository"]',
    'nav[aria-label="Repository navigation"]',
    '.UnderlineNav-body',
    '.js-repo-nav',
    '[data-testid="repo-nav"]',
  ].join(','));

  for (const candidate of candidates) {
    let hasCodeLink = false;
    let hasIssuesLink = false;

    for (const link of candidate.querySelectorAll('a[href]')) {
      try {
        const pathname = new URL(link.getAttribute('href'), window.location.origin).pathname;
        const repoRelativePath = pathname.slice(repositoryPath.length);
        if (
          pathname === repositoryPath ||
          repoRelativePath.startsWith('/tree/')
        ) {
          hasCodeLink = true;
        }
        if (repoRelativePath === '/issues' || repoRelativePath.startsWith('/issues/')) {
          hasIssuesLink = true;
        }
      } catch {
        // ignore invalid href values
      }
    }

    if (hasCodeLink && hasIssuesLink) {
      return candidate;
    }
  }

  return null;
}

function getRepoNavLinkByPathMatches(nav, pathnamePattern) {
  const links = [...nav.querySelectorAll('a[href]')].filter((link) => {
    const href = link.getAttribute('href') || '';
    return !!href && !href.startsWith('#') && href !== '/';
  });

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    try {
      const resolved = new URL(href, window.location.origin);
      if (pathnamePattern.test(resolved.pathname)) {
        return link;
      }
      const text = (link.textContent || '').trim().toLowerCase();
      if (text === 'issues' && pathnamePattern.test('/issues')) {
        return link;
      }
      if (text === 'pull requests' && pathnamePattern.test('/pulls')) {
        return link;
      }
    } catch {
      // ignore invalid href values
    }
  }

  return null;
}

function getRepoNavDirectChild(nav, node) {
  let child = node;
  while (child && child.parentElement !== nav) {
    child = child.parentElement;
  }
  return child;
}

function getRepoNavInsertionTarget(nav) {
  const issuesLink = getRepoNavLinkByPathMatches(nav, /^\/[^/]+\/[^/]+\/issues$/);
  if (issuesLink) {
    const issuesItem = getRepoNavDirectChild(nav, issuesLink);
    return issuesItem?.nextElementSibling || null;
  }

  const pullsLink = getRepoNavLinkByPathMatches(nav, /^\/[^/]+\/[^/]+\/pulls$/);
  return pullsLink ? getRepoNavDirectChild(nav, pullsLink) : null;
}

async function fetchIssueMapData(repoContext) {
  const result = await chrome.runtime.sendMessage({
    type: 'FETCH_ISSUE_MAP_DATA',
    ...repoContext,
  });
  if (!result?.ok) {
    throw new Error(result?.error || 'Could not retrieve the issue list');
  }
  return result;
}

function createIssueMapPage() {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    return null;
  }

  const wrapper = document.createElement('section');
  wrapper.id = ISSUE_MAP_TABLE_ID;
  wrapper.setAttribute('aria-labelledby', 'issue-map-view-heading');
  wrapper.style.cssText = 'margin: 24px auto; max-width: 1280px; padding: 0 16px; color: var(--fgColor-default, #1f2328); background-color: var(--bgColor-default, #fff); font-family: inherit; font-size: 9.33px; line-height: 1.5;';

  const heading = document.createElement('h2');
  heading.id = 'issue-map-view-heading';
  heading.textContent = 'Issues Map';
  heading.style.cssText = 'font-size: 16px; font-weight: 600; line-height: 1.25; margin: 0 0 16px;';

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 16px;';
  const statusMessage = document.createElement('span');
  statusMessage.setAttribute('role', 'status');
  statusMessage.style.cssText = 'color: var(--fgColor-muted, #656d76); font-size: 9.33px;';
  const createActions = document.createElement('div');
  createActions.style.cssText = 'display: flex; gap: 8px; margin-left: auto;';
  toolbar.append(statusMessage, createActions);

  const bindIssueCreateButton = (button, type, relatedAnalysisIssue = null) => {
    button.dataset.issueCreateType = type;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openIssueCreateDrawer(type, relatedAnalysisIssue).catch((error) => {
        statusMessage.textContent = `Could not open the creation form: ${error.message}`;
      });
    });
  };

  const bindIssueLinkButton = (button, relatedAnalysisIssue = null) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openIssueLinkDrawer(repoContext, relatedAnalysisIssue).catch((error) => {
        statusMessage.textContent = `Could not open the linking form: ${error.message}`;
      });
    });
  };

  const tableWrapper = document.createElement('div');
  tableWrapper.style.cssText = 'overflow-x: auto; border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px; background-color: var(--bgColor-default, #fff);';
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse: collapse; min-width: 100%; width: max-content; table-layout: auto; color: inherit; font: inherit;';
  const header = document.createElement('thead');
  const groups = document.createElement('tr');
  const analysisNumberHeader = document.createElement('th');
  analysisNumberHeader.textContent = 'Number';
  analysisNumberHeader.rowSpan = 2;
  analysisNumberHeader.style.cssText = 'min-width: 72px;';
  const analysisHeader = document.createElement('th');
  analysisHeader.textContent = 'Analysis Result';
  analysisHeader.colSpan = 9;
  const countermeasureNumberHeader = document.createElement('th');
  countermeasureNumberHeader.textContent = 'Number';
  countermeasureNumberHeader.rowSpan = 2;
  countermeasureNumberHeader.style.cssText = 'min-width: 72px;';
  const countermeasureHeader = document.createElement('th');
  countermeasureHeader.textContent = 'Countermeasure';
  countermeasureHeader.colSpan = 8;
  groups.append(analysisNumberHeader, analysisHeader, countermeasureNumberHeader, countermeasureHeader);

  const columns = document.createElement('tr');
  const columnNames = [
    'Failure Mode', 'Failure Cause', 'Failure Classification', 'Preventive Measure',
    'Detection Method', 'Effect', 'Severity', 'Occurrence', 'Detection',
    'Content', 'Effect(Effect)', 'Effect(Occurrence)', 'Effect(Detection)',
    'RPN', 'Status', 'Owner', 'Deadline',
  ];
  for (const name of columnNames) {
    const cell = document.createElement('th');
    cell.textContent = name;
    cell.style.cssText = 'min-width: 130px;';
    columns.appendChild(cell);
  }
  for (const row of [groups, columns]) {
    for (const cell of row.children) {
      cell.style.cssText += 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); background: var(--bgColor-muted, #f6f8fa); color: var(--fgColor-default, #1f2328); font-size: 9.33px; font-weight: 600; text-align: left; vertical-align: top; white-space: nowrap;';
    }
  }
  header.append(groups, columns);
  const body = document.createElement('tbody');
  const initialRow = document.createElement('tr');
  const initialCell = document.createElement('td');
  initialCell.colSpan = 20;
  initialCell.textContent = 'Loading...';
  initialCell.style.cssText = 'padding: 16px; text-align: center; color: var(--fgColor-muted, #656d76);';
  initialRow.appendChild(initialCell);
  body.appendChild(initialRow);
  table.append(header, body);
  tableWrapper.appendChild(table);

  const renderEmptyState = async (utilities) => {
    const row = document.createElement('tr');
    const appendNumberCell = () => {
      const numberCell = document.createElement('td');
      numberCell.style.cssText = 'padding: 16px; border: 1px solid var(--borderColor-default, #d1d9e0);';
      row.appendChild(numberCell);
    };
    const appendEmptyCategoryCell = (label, type, span) => {
      const cell = document.createElement('td');
      cell.colSpan = span;
      cell.style.cssText = 'padding: 16px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
      const message = document.createElement('p');
      message.textContent = label;
      message.style.cssText = 'margin: 0 0 12px;';
      const createButton = document.createElement('a');
      createButton.textContent = 'Create new';
      createButton.className = 'btn btn-sm';
      createButton.href = utilities.buildIssueCreateUrl({ ...repoContext, type });
      bindIssueCreateButton(createButton, type);
      createButton.style.cssText = 'margin-right: 8px; font-size: 9.33px;';
      const listButton = document.createElement('a');
      listButton.textContent = 'Link';
      listButton.className = 'btn btn-sm';
      listButton.href = utilities.buildIssueListUrl({ ...repoContext, type });
      listButton.style.fontSize = '9.33px';
      bindIssueLinkButton(listButton);
      cell.append(message, createButton, listButton);
      row.appendChild(cell);
    };
    appendNumberCell();
    appendEmptyCategoryCell('No analysis results.', ISSUE_MAP_TYPES.ANALYSIS_RESULT, 9);
    appendNumberCell();
    appendEmptyCategoryCell('No countermeasures.', ISSUE_MAP_TYPES.COUNTERMEASURE, 8);
    body.replaceChildren(row);
  };

  const showCreateActions = () => {
    createActions.replaceChildren();
    for (const [label, type] of [
      ['Create analysis result', ISSUE_MAP_TYPES.ANALYSIS_RESULT],
      ['Create countermeasure', ISSUE_MAP_TYPES.COUNTERMEASURE],
    ]) {
      const button = document.createElement('a');
      button.textContent = label;
      button.className = 'btn btn-primary btn-sm';
      button.href = buildIssueCreateUrl({ ...repoContext, type });
      bindIssueCreateButton(button, type);
      button.style.fontSize = '9.33px';
      createActions.appendChild(button);
    }
  };
  showCreateActions();

  const createEmptyCategoryCell = (type, message, utilities, relatedAnalysisIssue = null) => {
    const cell = document.createElement('td');
    cell.colSpan = type === ISSUE_MAP_TYPES.ANALYSIS_RESULT ? 9 : 8;
    cell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = 'margin-bottom: 8px; color: var(--fgColor-muted, #656d76);';
    const createButton = document.createElement('a');
    createButton.textContent = 'Create new';
    createButton.className = 'btn btn-sm';
    createButton.href = utilities.buildIssueCreateUrl({ ...repoContext, type });
    bindIssueCreateButton(createButton, type, relatedAnalysisIssue);
    createButton.style.cssText = 'margin-right: 8px; font-size: 9.33px;';
    const listButton = document.createElement('a');
    listButton.textContent = 'Link';
    listButton.className = 'btn btn-sm';
    listButton.href = utilities.buildIssueListUrl({ ...repoContext, type });
    listButton.style.fontSize = '9.33px';
    bindIssueLinkButton(listButton, relatedAnalysisIssue);
    cell.append(text, createButton, listButton);
    return cell;
  };

  const renderIssues = (analysisIssues, countermeasureIssues, utilities) => {
    const rows = [];
    const { groups, unlinkedCountermeasures } =
      utilities.groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues);
    const issuePairs = groups.flatMap(({ analysisIssue, countermeasureIssues: linked }) => (
      linked.length > 0
        ? linked.map((countermeasureIssue) => ({ analysisIssue, countermeasureIssue }))
        : [{ analysisIssue, countermeasureIssue: null }]
    ));
    issuePairs.push(...unlinkedCountermeasures.map((countermeasureIssue) => ({
      analysisIssue: null,
      countermeasureIssue,
    })));

    for (const { analysisIssue, countermeasureIssue } of issuePairs) {
      const row = document.createElement('tr');
      const createIssueNumberCell = (issue) => {
        const numberCell = document.createElement('td');
        numberCell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
        if (issue) {
          const issueReference = document.createElement('div');
          const issueLink = document.createElement('a');
          issueLink.href = issue.html_url;
          issueLink.target = '_blank';
          issueLink.rel = 'noopener noreferrer';
          issueLink.textContent = `#${issue.number}`;
          issueLink.title = `View ${issue.title} (#${issue.number})`;
          issueLink.setAttribute('aria-label', issueLink.title);
          issueLink.addEventListener('click', (event) => {
            event.preventDefault();
            openIssueDetailsDrawer(issue).catch((error) => {
              statusMessage.textContent = `Could not open issue details: ${error.message}`;
            });
          });
          issueReference.appendChild(issueLink);
          numberCell.appendChild(issueReference);
        }
        return numberCell;
      };
      row.appendChild(createIssueNumberCell(analysisIssue));

      const analysis = analysisIssue?.parsed;
      const countermeasure = countermeasureIssue?.parsed;
      const analysisValues = analysis
        ? [analysis.failureMode, analysis.failureCause, analysis.failureCategory,
            analysis.prevention, analysis.detectionMethod, analysis.effect,
            analysis.severity, analysis.occurrence, analysis.detection]
        : null;
      if (analysisValues) {
        for (const value of analysisValues) {
          const cell = document.createElement('td');
          cell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); background-color: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328); font-size: 9.33px; vertical-align: top; white-space: normal; overflow-wrap: anywhere;';
          cell.textContent = value === '' || value == null ? '' : String(value);
          row.appendChild(cell);
        }
      } else {
        if (analysisIssue) {
          row.appendChild(createEmptyCategoryCell(
            ISSUE_MAP_TYPES.ANALYSIS_RESULT,
            'No analysis result is linked.',
            utilities
          ));
        } else {
          const emptyAnalysisCell = document.createElement('td');
          emptyAnalysisCell.colSpan = 9;
          emptyAnalysisCell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); color: var(--fgColor-muted, #656d76); vertical-align: top;';
          emptyAnalysisCell.textContent = 'No linked analysis result.';
          row.appendChild(emptyAnalysisCell);
        }
      }

      row.appendChild(createIssueNumberCell(countermeasureIssue));
      const countermeasureValues = countermeasure
        ? [countermeasure.content, countermeasure.effectImpact,
            countermeasure.effectOccurrence, countermeasure.effectDetection,
            countermeasure.rpn, countermeasureIssue.countermeasureStatus,
            countermeasure.owner, countermeasure.deadline]
        : null;
      if (countermeasureValues) {
        for (const [valueIndex, value] of countermeasureValues.entries()) {
          const cell = document.createElement('td');
          cell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); background-color: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328); font-size: 9.33px; vertical-align: top; white-space: normal; overflow-wrap: anywhere;';
          cell.textContent = value === '' || value == null ? '' : String(value);
          if (valueIndex === 5 && countermeasureIssue.countermeasureStatusError) {
            cell.title = countermeasureIssue.countermeasureStatusError;
          }
          row.appendChild(cell);
        }
      } else {
        row.appendChild(createEmptyCategoryCell(
            ISSUE_MAP_TYPES.COUNTERMEASURE,
            'No countermeasures.',
            utilities,
            analysisIssue
        ));
      }
      rows.push(row);
    }
    body.replaceChildren(...rows);
  };

  const loadIssues = async () => {
    if (wrapper.loading) {
      return;
    }
    wrapper.loading = true;
    let utilities;
    statusMessage.textContent = 'Loading...';
    try {
      utilities = await issueMapUtilities;
      showCreateActions();
      const { analysisIssues: rawAnalysisIssues, countermeasureIssues: rawCountermeasureIssues } =
        await fetchIssueMapData(repoContext);
      const analysisIssues = rawAnalysisIssues.map((issue) => {
        const parsed = utilities.parseAnalysisResult(issue.body || '');
        return {
          ...issue,
          parsed: { ...parsed, failureMode: parsed.failureMode || issue.title },
        };
      });
      const countermeasureIssues = rawCountermeasureIssues.map((issue) => {
        const parsed = utilities.parseCountermeasure(issue.body || '');
        return {
          ...issue,
          parsed: { ...parsed, content: parsed.content || issue.title },
        };
      });
      if (analysisIssues.length === 0 && countermeasureIssues.length === 0) {
        await renderEmptyState(utilities);
      } else {
        renderIssues(analysisIssues, countermeasureIssues, utilities);
      }
      statusMessage.textContent = `${analysisIssues.length} analysis results, ${countermeasureIssues.length} countermeasures`;
    } catch (error) {
      statusMessage.textContent = `Could not load issues: ${error.message}`;
      const errorRow = document.createElement('tr');
      const errorCell = document.createElement('td');
      errorCell.colSpan = 20;
      errorCell.textContent = statusMessage.textContent;
      errorCell.style.cssText = 'padding: 16px; color: var(--fgColor-danger, #cf222e); text-align: center;';
      errorRow.appendChild(errorCell);
      body.replaceChildren(errorRow);
    } finally {
      wrapper.loading = false;
      wrapper.loaded = true;
    }
  };
  wrapper.append(heading, toolbar, tableWrapper);
  wrapper.loadIssues = loadIssues;
  wrapper.loading = false;
  wrapper.loaded = false;

  return wrapper;
}

function restoreRepositoryPage() {
  if (!issueMapPageState) {
    return;
  }

  issueMapPageState.page.remove();
  for (const [element, wasHidden] of issueMapPageState.hiddenElements) {
    element.hidden = wasHidden;
  }
  issueMapPageState = null;
}

function showIssueMapPage() {
  const main = document.querySelector('main') || document.body;
  if (!main) {
    return;
  }

  if (
    issueMapPageState &&
    (issueMapPageState.main !== main || issueMapPageState.pathname !== window.location.pathname)
  ) {
    restoreRepositoryPage();
  }

  if (!issueMapPageState) {
    const page = createIssueMapPage();
    if (!page) {
      return;
    }
    issueMapPageState = {
      main,
      page,
      pathname: window.location.pathname,
      hiddenElements: new Map(),
    };
  }

  const nav = getRepoNavigation();
  const { page, hiddenElements } = issueMapPageState;
  if (!page.isConnected || page.parentElement !== main) {
    main.appendChild(page);
  }
  if (!page.loading && !page.loaded) {
    page.loadIssues();
  }

  for (const element of main.querySelectorAll('*')) {
    const isNavigation = nav && (element === nav || nav.contains(element) || element.contains(nav));
    if (isNavigation || element === page || page.contains(element) || element.contains(page)) {
      continue;
    }

    if (!hiddenElements.has(element)) {
      hiddenElements.set(element, element.hidden);
    }
    element.hidden = true;
  }
}

function syncIssueMapView() {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    restoreRepositoryPage();
    return;
  }

  addIssueMapTab();

  const isIssueMapPage = window.location.hash === ISSUE_MAP_ROUTE_HASH;
  const menu = document.getElementById(ISSUE_MAP_MENU_ID);
  if (menu) {
    menu.classList.toggle('selected', isIssueMapPage);
    menu.setAttribute('aria-selected', String(isIssueMapPage));
    if (isIssueMapPage) {
      menu.setAttribute('aria-current', 'page');
    } else {
      menu.removeAttribute('aria-current');
    }
  }

  if (isIssueMapPage) {
    showIssueMapPage();
  } else {
    restoreRepositoryPage();
  }
}

function leaveIssueMapForRepositoryNavigation(event) {
  if (window.location.hash !== ISSUE_MAP_ROUTE_HASH || !(event.target instanceof Element)) {
    return;
  }

  const link = event.target.closest('a[href]');
  const nav = getRepoNavigation();
  if (!link || link.id === ISSUE_MAP_MENU_ID || !nav?.contains(link)) {
    return;
  }

  const url = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', url);
  syncIssueMapView();
}

function addIssueMapTab() {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    return;
  }

  const nav = getRepoNavigation();
  let button = document.getElementById(ISSUE_MAP_MENU_ID);
  if (!button) {
    button = document.createElement('a');
    button.id = ISSUE_MAP_MENU_ID;
    button.href = ISSUE_MAP_ROUTE_HASH;
    button.setAttribute('role', 'tab');
    button.className = 'UnderlineNav-item';
    button.style.cssText = 'display: inline-flex; align-items: center; align-self: stretch;';
    button.innerHTML = `${ISSUE_MAP_MENU_SVG}<span>Issues Map</span>`;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.location.hash === ISSUE_MAP_ROUTE_HASH) {
        syncIssueMapView();
      } else {
        window.location.hash = ISSUE_MAP_ROUTE_HASH;
      }
    });
  }

  if (nav) {
    const insertionTarget = getRepoNavInsertionTarget(nav);
    const target = insertionTarget?.parentNode === nav ? insertionTarget : null;
    const isInPosition = button.parentNode === nav && (
      target ? button.nextElementSibling === target || target === button : button === nav.lastElementChild
    );
    if (!isInPosition) {
      nav.insertBefore(button, target);
    }
    return;
  }

  if (button.isConnected) {
    return;
  }

  const fallback = document.querySelector('main') || document.body;
  if (!fallback) {
    return;
  }

  fallback.appendChild(button);
}

function initializeIssueMapView() {
  syncIssueMapView();
}

const observer = new MutationObserver(() => {
  syncIssueMapView();
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

window.addEventListener('hashchange', syncIssueMapView);
window.addEventListener('popstate', syncIssueMapView);
document.addEventListener('click', leaveIssueMapForRepositoryNavigation, true);
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'OPEN_ISSUE_CREATE_DRAWER') {
    return false;
  }

  openIssueCreateDrawer(message.issueType)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

initializeIssueMapView();
