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
  submitButton.textContent = '作成中...';
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
      throw new Error(response?.error || 'GitHub APIでIssueを作成できませんでした');
    }

    const successMessage = document.createElement('p');
    successMessage.textContent = 'Issueを作成しました。';
    successMessage.setAttribute('role', 'status');
    const issueLink = document.createElement('a');
    issueLink.href = response.issueUrl;
    issueLink.textContent = '作成したIssueを表示';
    issueLink.target = '_blank';
    issueLink.rel = 'noopener noreferrer';
    content.replaceChildren(successMessage, issueLink);
  } catch (error) {
    statusMessage.textContent = `Issueを作成できませんでした: ${error.message}`;
    submitButton.disabled = false;
    submitButton.textContent = 'Issueを作成';
  }
}

function renderIssueCreateForm(content, utilities, repoContext, type) {
  const form = document.createElement('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'タイトル';
  titleLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.name = 'title';
  titleInput.required = true;
  titleInput.maxLength = 256;
  titleInput.className = 'form-control';
  titleInput.setAttribute('aria-label', 'Issueのタイトル');
  titleLabel.appendChild(titleInput);

  const bodyLabel = document.createElement('label');
  bodyLabel.textContent = '本文';
  bodyLabel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-weight: 600;';
  const bodyInput = document.createElement('textarea');
  bodyInput.name = 'body';
  bodyInput.rows = 18;
  bodyInput.className = 'form-control';
  bodyInput.setAttribute('aria-label', 'Issueの本文');
  bodyInput.value = new URL(utilities.buildIssueCreateUrl({ ...repoContext, type }))
    .searchParams.get('body') || '';
  bodyLabel.appendChild(bodyInput);

  const labelMessage = document.createElement('p');
  labelMessage.textContent = `付与ラベル: ${type}`;
  labelMessage.className = 'text-small color-fg-muted';
  labelMessage.style.margin = '0';
  const statusMessage = document.createElement('p');
  statusMessage.setAttribute('role', 'status');
  statusMessage.setAttribute('aria-live', 'polite');
  statusMessage.style.color = 'var(--fgColor-danger, #cf222e)';
  statusMessage.style.margin = '0';
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Issueを作成';
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

async function openIssueCreateDrawer(type) {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    throw new Error('リポジトリ画面でのみ新規作成できます');
  }

  closeIssueCreateDrawer();
  const utilities = await issueMapUtilities;
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 9999; display: flex; justify-content: flex-end; background: var(--bgColor-default, #fff);';
  const drawer = document.createElement('section');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', type === ISSUE_MAP_TYPES.COUNTERMEASURE ? '対策を新規作成' : '解析結果を新規作成');
  drawer.style.cssText = 'display: flex; flex-direction: column; width: min(640px, 100vw); height: 100%; overflow: hidden; color: var(--fgColor-default, #1f2328); background: var(--bgColor-default, #fff); box-shadow: -8px 0 24px rgba(31, 35, 40, 0.2);';

  const header = document.createElement('header');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--borderColor-default, #d1d9e0);';
  const title = document.createElement('h2');
  title.textContent = type === ISSUE_MAP_TYPES.COUNTERMEASURE ? '対策を新規作成' : '解析結果を新規作成';
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '閉じる';
  closeButton.className = 'btn btn-sm';
  closeButton.setAttribute('aria-label', '新規作成ドロワーを閉じる');
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
  renderIssueCreateForm(content, utilities, repoContext, type);
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
    throw new Error(result?.error || 'Issue一覧を取得できませんでした');
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
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = '更新';
  refreshButton.className = 'btn btn-sm';
  refreshButton.style.fontSize = '9.33px';
  const statusMessage = document.createElement('span');
  statusMessage.setAttribute('role', 'status');
  statusMessage.style.cssText = 'color: var(--fgColor-muted, #656d76); font-size: 9.33px;';
  const emptyCreateActions = document.createElement('div');
  emptyCreateActions.style.cssText = 'display: none; gap: 8px; margin-left: auto;';
  toolbar.append(refreshButton, statusMessage, emptyCreateActions);

  const bindIssueCreateButton = (button, type) => {
    button.dataset.issueCreateType = type;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openIssueCreateDrawer(type).catch((error) => {
        statusMessage.textContent = `新規作成画面を開けませんでした: ${error.message}`;
      });
    });
  };

  const tableWrapper = document.createElement('div');
  tableWrapper.style.cssText = 'overflow-x: auto; border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px; background-color: var(--bgColor-default, #fff);';
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse: collapse; min-width: 100%; width: max-content; table-layout: auto; color: inherit; font: inherit;';
  const header = document.createElement('thead');
  const groups = document.createElement('tr');
  const numberHeader = document.createElement('th');
  numberHeader.textContent = 'Number';
  numberHeader.rowSpan = 2;
  numberHeader.style.cssText = 'min-width: 72px;';
  const analysisHeader = document.createElement('th');
  analysisHeader.textContent = 'Analysis Result';
  analysisHeader.colSpan = 9;
  const countermeasureHeader = document.createElement('th');
  countermeasureHeader.textContent = 'Countermeasure';
  countermeasureHeader.colSpan = 8;
  groups.append(numberHeader, analysisHeader, countermeasureHeader);

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
  initialCell.colSpan = 18;
  initialCell.textContent = '読み込み中...';
  initialCell.style.cssText = 'padding: 16px; text-align: center; color: var(--fgColor-muted, #656d76);';
  initialRow.appendChild(initialCell);
  body.appendChild(initialRow);
  table.append(header, body);
  tableWrapper.appendChild(table);

  const renderEmptyState = async (utilities) => {
    const row = document.createElement('tr');
    const numberCell = document.createElement('td');
    numberCell.style.cssText = 'padding: 16px; border: 1px solid var(--borderColor-default, #d1d9e0);';
    row.appendChild(numberCell);
    for (const [label, type, span] of [
      ['解析結果はありません。', ISSUE_MAP_TYPES.ANALYSIS_RESULT, 9],
      ['対策はありません。', ISSUE_MAP_TYPES.COUNTERMEASURE, 8],
    ]) {
      const cell = document.createElement('td');
      cell.colSpan = span;
      cell.style.cssText = 'padding: 16px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
      const message = document.createElement('p');
      message.textContent = label;
      message.style.cssText = 'margin: 0 0 12px;';
      const createButton = document.createElement('a');
      createButton.textContent = '新規作成';
      createButton.className = 'btn btn-sm';
      createButton.href = utilities.buildIssueCreateUrl({ ...repoContext, type });
      bindIssueCreateButton(createButton, type);
      createButton.style.cssText = 'margin-right: 8px; font-size: 9.33px;';
      const listButton = document.createElement('a');
      listButton.textContent = 'リンク';
      listButton.className = 'btn btn-sm';
      listButton.href = utilities.buildIssueListUrl({ ...repoContext, type });
      listButton.style.fontSize = '9.33px';
      cell.append(message, createButton, listButton);
      row.appendChild(cell);
    }
    body.replaceChildren(row);
  };

  const showEmptyCreateActions = (utilities) => {
    emptyCreateActions.replaceChildren();
    for (const [label, type] of [
      ['解析結果を新規作成', ISSUE_MAP_TYPES.ANALYSIS_RESULT],
      ['対策を新規作成', ISSUE_MAP_TYPES.COUNTERMEASURE],
    ]) {
      const button = document.createElement('a');
      button.textContent = label;
      button.className = 'btn btn-primary btn-sm';
      button.href = utilities.buildIssueCreateUrl({ ...repoContext, type });
      bindIssueCreateButton(button, type);
      button.style.fontSize = '9.33px';
      emptyCreateActions.appendChild(button);
    }
    emptyCreateActions.style.display = 'flex';
  };

  const createEmptyCategoryCell = (type, message, utilities) => {
    const cell = document.createElement('td');
    cell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
    const text = document.createElement('div');
    text.textContent = message;
    text.style.cssText = 'margin-bottom: 8px; color: var(--fgColor-muted, #656d76);';
    const createButton = document.createElement('a');
    createButton.textContent = '新規作成';
    createButton.className = 'btn btn-sm';
    createButton.href = utilities.buildIssueCreateUrl({ ...repoContext, type });
    bindIssueCreateButton(createButton, type);
    createButton.style.cssText = 'margin-right: 8px; font-size: 9.33px;';
    const listButton = document.createElement('a');
    listButton.textContent = 'リンク';
    listButton.className = 'btn btn-sm';
    listButton.href = utilities.buildIssueListUrl({ ...repoContext, type });
    listButton.style.fontSize = '9.33px';
    cell.append(text, createButton, listButton);
    return cell;
  };

  const renderIssues = (analysisIssues, countermeasureIssues, utilities) => {
    const rows = [];
    const count = Math.max(analysisIssues.length, countermeasureIssues.length);
    for (let index = 0; index < count; index += 1) {
      const row = document.createElement('tr');
      const numberCell = document.createElement('td');
      numberCell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); vertical-align: top;';
      numberCell.appendChild(document.createTextNode(String(index + 1)));
      for (const issue of [analysisIssues[index], countermeasureIssues[index]]) {
        if (!issue) {
          continue;
        }
        const issueReference = document.createElement('div');
        issueReference.textContent = `#${issue.number}: ${issue.title} `;
        const showButton = document.createElement('a');
        showButton.href = issue.html_url;
        showButton.target = '_blank';
        showButton.rel = 'noopener noreferrer';
        showButton.textContent = '表示';
        showButton.title = `${issue.title} (#${issue.number}) を表示`;
        showButton.setAttribute('aria-label', showButton.title);
        showButton.className = 'btn btn-sm';
        showButton.style.fontSize = '9.33px';
        issueReference.appendChild(showButton);
        numberCell.appendChild(issueReference);
      }
      row.appendChild(numberCell);

      const analysis = analysisIssues[index]?.parsed;
      const countermeasure = countermeasureIssues[index]?.parsed;
      const values = analysis
        ? [
            analysis.failureMode, analysis.failureCause, analysis.failureCategory,
            analysis.prevention, analysis.detectionMethod, analysis.effect,
            analysis.severity, analysis.occurrence, analysis.detection,
          ]
        : Array(9).fill('');
      values.push(...(countermeasure
        ? [
            countermeasure.content, countermeasure.effectImpact,
            countermeasure.effectOccurrence, countermeasure.effectDetection,
            countermeasure.rpn, countermeasureIssues[index].countermeasureStatus,
            countermeasure.owner, countermeasure.deadline,
          ]
        : Array(8).fill('')));

      for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        const cell = document.createElement('td');
        cell.style.cssText = 'padding: 8px; border: 1px solid var(--borderColor-default, #d1d9e0); background-color: var(--bgColor-default, #fff); color: var(--fgColor-default, #1f2328); font-size: 9.33px; vertical-align: top; white-space: normal; overflow-wrap: anywhere;';
        if (index === 0 && valueIndex === 0 && analysisIssues.length === 0) {
          row.appendChild(createEmptyCategoryCell(
            ISSUE_MAP_TYPES.ANALYSIS_RESULT,
            '解析結果はありません。',
            utilities
          ));
          continue;
        }
        if (index === 0 && valueIndex === 9 && countermeasureIssues.length === 0) {
          row.appendChild(createEmptyCategoryCell(
            ISSUE_MAP_TYPES.COUNTERMEASURE,
            '対策はありません。',
            utilities
          ));
          continue;
        }
        const value = values[valueIndex];
        cell.textContent = value === '' || value == null ? '' : String(value);
        row.appendChild(cell);
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
    statusMessage.textContent = '読み込み中...';
    refreshButton.disabled = true;
    try {
      utilities = await issueMapUtilities;
      const { analysisIssues: rawAnalysisIssues, countermeasureIssues: rawCountermeasureIssues } =
        await fetchIssueMapData(repoContext);
      const analysisIssues = rawAnalysisIssues.map((issue) => ({
        ...issue,
        parsed: utilities.parseAnalysisResult(issue.body || ''),
      }));
      const countermeasureIssues = rawCountermeasureIssues.map((issue) => ({
        ...issue,
        parsed: utilities.parseCountermeasure(issue.body || ''),
      }));
      if (analysisIssues.length === 0 && countermeasureIssues.length === 0) {
        await renderEmptyState(utilities);
        showEmptyCreateActions(utilities);
      } else {
        emptyCreateActions.style.display = 'none';
        renderIssues(analysisIssues, countermeasureIssues, utilities);
      }
      statusMessage.textContent = `${analysisIssues.length} 件の解析結果、${countermeasureIssues.length} 件の対策`;
    } catch (error) {
      if (utilities) {
        showEmptyCreateActions(utilities);
      }
      statusMessage.textContent = `読み込みに失敗しました: ${error.message}`;
      const errorRow = document.createElement('tr');
      const errorCell = document.createElement('td');
      errorCell.colSpan = 18;
      errorCell.textContent = statusMessage.textContent;
      errorCell.style.cssText = 'padding: 16px; color: var(--fgColor-danger, #cf222e); text-align: center;';
      errorRow.appendChild(errorCell);
      body.replaceChildren(errorRow);
    } finally {
      refreshButton.disabled = false;
      wrapper.loading = false;
      wrapper.loaded = true;
    }
  };
  refreshButton.addEventListener('click', () => {
    wrapper.loaded = false;
    loadIssues();
  });
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
