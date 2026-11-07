const ISSUE_MAP_TYPES = {
  ANALYSIS_RESULT: 'analysis_result',
  COUNTERMEASURE: 'countermeasure',
};

const ISSUE_MAP_MENU_ID = 'issue-map-menu-button';
const ISSUE_MAP_TABLE_ID = 'issue-map-view-table';
const ISSUE_MAP_ROUTE_HASH = '#issue-map-view';
const ISSUE_MAP_MENU_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" style="margin-right: 6px;">
    <path fill="currentColor" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Zm1.5-.5a.5.5 0 0 0-.5.5v9c0 .28.22.5.5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9ZM4 5h8v1H4V5Zm0 3h8v1H4V8Zm0 3h5v1H4v-1Z"/>
  </svg>
`;

let issueMapPageState = null;

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

function createIssueMapPage() {
  const repoContext = getRepositoryContext();
  if (!repoContext) {
    return null;
  }

  const wrapper = document.createElement('section');
  wrapper.id = ISSUE_MAP_TABLE_ID;
  wrapper.setAttribute('aria-labelledby', 'issue-map-view-heading');
  wrapper.style.cssText = 'margin-top: 24px; border-top: 1px solid #d0d7de; padding-top: 24px;';

  const heading = document.createElement('h2');
  heading.id = 'issue-map-view-heading';
  heading.textContent = 'Issues Map';
  heading.style.cssText = 'font-size: 20px; margin: 0 0 16px;';

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 16px;';

  const createIssueCard = ({ type, title }) => {
    const card = document.createElement('div');
    card.style.cssText = 'border: 1px solid #d0d7de; border-radius: 8px; background: #fff; padding: 12px; min-height: 220px;';

    const label = document.createElement('div');
    label.textContent = title;
    label.style.cssText = 'font-weight: 600; margin-bottom: 12px; color: #24292f;';

    const blank = document.createElement('div');
    blank.textContent = '空欄';
    blank.style.cssText = 'color: #57606a; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed #d0d7de; border-radius: 6px; background: #f6f8fa;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 8px;';

    const createButton = document.createElement('button');
    createButton.textContent = '新規作成';
    createButton.type = 'button';
    createButton.style.cssText = 'flex: 1; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; padding: 8px 6px; cursor: pointer;';
    createButton.addEventListener('click', () => {
      const url = buildIssueCreateUrl({
        owner: repoContext.owner,
        repo: repoContext.repo,
        type,
      });
      window.open(url, '_blank', 'noopener');
    });

    const linkButton = document.createElement('button');
    linkButton.textContent = 'リンク';
    linkButton.type = 'button';
    linkButton.style.cssText = 'flex: 1; border: 1px solid #d0d7de; border-radius: 6px; background: #ffffff; padding: 8px 6px; cursor: pointer;';
    linkButton.addEventListener('click', () => {
      const url = buildIssueListUrl({
        owner: repoContext.owner,
        repo: repoContext.repo,
        type,
      });
      window.open(url, '_blank', 'noopener');
    });

    buttons.appendChild(createButton);
    buttons.appendChild(linkButton);
    card.appendChild(label);
    card.appendChild(blank);
    card.appendChild(buttons);

    return card;
  };

  grid.appendChild(createIssueCard({
    type: ISSUE_MAP_TYPES.ANALYSIS_RESULT,
    title: '解析結果',
  }));

  grid.appendChild(createIssueCard({
    type: ISSUE_MAP_TYPES.COUNTERMEASURE,
    title: '対策',
  }));

  wrapper.appendChild(heading);
  wrapper.appendChild(grid);

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

initializeIssueMapView();
