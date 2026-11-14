import { After, Before, setDefaultTimeout, setWorldConstructor } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const repositoryHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Fixture repository</title></head>
  <body>
    <main>
      <nav aria-label="Repository" class="UnderlineNav-body">
        <a href="/octo-org/demo-repo">Code</a>
        <a href="/octo-org/demo-repo/issues">Issues</a>
        <a href="/octo-org/demo-repo/pulls">Pull requests</a>
      </nav>
      <section id="repository-content"><h1>Repository content</h1></section>
    </main>
  </body>
</html>`;
const incompleteRepositoryHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Repository settings</title></head>
  <body>
    <main>
      <nav aria-label="Repository" class="UnderlineNav-body">
        <a href="/octo-org/demo-repo">Code</a>
        <a href="/octo-org/demo-repo/issues">Issues</a>
        <a href="/octo-org/demo-repo/settings">Settings</a>
      </nav>
      <section id="repository-content"><h1>Repository settings</h1></section>
    </main>
  </body>
</html>`;

function createIssue(number, title, type, body) {
  return {
    number,
    title,
    body,
    labels: [{ name: type }],
    html_url: `https://github.com/octo-org/demo-repo/issues/${number}`,
  };
}

function defaultFixtures() {
  return {
    nextIssueNumber: 100,
    analysisIssues: [],
    countermeasureIssues: [],
    pullRequests: [],
  };
}

class IssueMapWorld {
  async startServer() {
    this.server = createServer(async (request, response) => {
      const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
      if (requestPath === '/src/lib/issue-map.js') {
        try {
          const modulePath = path.join(projectRoot, 'src/lib/issue-map.js');
          const source = await readFile(modulePath);
          response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
          response.end(source);
        } catch (error) {
          response.writeHead(500);
          response.end(error.message);
        }
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(requestPath.endsWith('/settings') ? incompleteRepositoryHtml : repositoryHtml);
    });
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    this.baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async openIssueMap() {
    await this.page.addInitScript((initialFixtures) => {
      window.__issueMapTestState = structuredClone(initialFixtures);
    }, this.fixtures);
    await this.page.goto(`${this.baseUrl}/octo-org/demo-repo`);
    await this.page.addScriptTag({ path: path.join(projectRoot, 'src/content.js') });
    await this.page.getByRole('tab', { name: 'Issues Map' }).click();
    await this.page.locator('#issue-map-view-table tbody tr').first().waitFor();
    await this.page.getByText(/\d+ analysis results,/).waitFor();
  }

  async openRepositoryPageWithoutPullRequestsNavigation() {
    await this.page.goto(`${this.baseUrl}/octo-org/demo-repo/settings#issue-map-view`);
    await this.page.addScriptTag({ path: path.join(projectRoot, 'src/content.js') });
  }

  async startPage() {
    this.fixtures = defaultFixtures();
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    const baseUrl = this.baseUrl;
    await this.page.addInitScript(({ runtimeBaseUrl }) => {
      const messageListeners = [];
      const state = () => window.__issueMapTestState;
      window.chrome = {
        runtime: {
          getURL: (resource) => `${runtimeBaseUrl}/src/${resource}`,
          onMessage: {
            addListener: (listener) => messageListeners.push(listener),
          },
          sendMessage: async (message) => {
            if (message.type === 'FETCH_ISSUE_MAP_DATA') {
              return {
                ok: true,
                analysisIssues: state().analysisIssues,
                countermeasureIssues: state().countermeasureIssues,
              };
            }
            if (message.type === 'FETCH_REPOSITORY_PULL_REQUESTS') {
              return { ok: true, pullRequests: state().pullRequests };
            }
            if (message.type === 'FETCH_ISSUE_DETAILS') {
              const issue = [...state().analysisIssues, ...state().countermeasureIssues]
                .find((item) => item.number === message.issueNumber);
              if (!issue) {
                return { ok: false, error: 'Issue not found' };
              }
              return {
                ok: true,
                issue: { ...issue, assignees: [], milestone: null },
                labels: [...state().analysisIssues, ...state().countermeasureIssues]
                  .flatMap((item) => item.labels)
                  .filter((label, index, list) => (
                    list.findIndex((candidate) => candidate.name === label.name) === index
                  )),
                assignees: [],
                milestones: [],
                projects: [],
                projectItems: [],
                projectError: null,
                events: [],
              };
            }
            if (message.type === 'UPDATE_ISSUE_DETAILS') {
              const issue = [...state().analysisIssues, ...state().countermeasureIssues]
                .find((item) => item.number === message.issueNumber);
              if (!issue) {
                return { ok: false, error: 'Issue not found' };
              }
              issue.title = message.title;
              issue.body = message.body;
              issue.labels = message.labels.map((name) => ({ name }));
              return { ok: true, issueUrl: issue.html_url };
            }
            if (message.type === 'CREATE_GITHUB_ISSUE') {
              const issue = {
                number: state().nextIssueNumber++,
                title: message.title,
                body: message.body,
                labels: [{ name: message.issueType }],
                html_url: `https://github.com/${message.owner}/${message.repo}/issues/${state().nextIssueNumber - 1}`,
              };
              state()[message.issueType === 'analysis_result' ? 'analysisIssues' : 'countermeasureIssues']
                .push(issue);
              return { ok: true, issueNumber: issue.number, issueUrl: issue.html_url };
            }
            if (message.type === 'LINK_PULL_REQUEST_ISSUES') {
              const pullRequest = state().pullRequests
                .find((item) => item.number === message.pullRequestNumber);
              if (!pullRequest) {
                return { ok: false, error: 'Pull request not found' };
              }
              const numbers = [
                ...message.analysisIssueNumbers,
                ...message.countermeasureIssueNumbers,
              ];
              const references = new Set(
                [...pullRequest.body.matchAll(/Related to #(\d+)/g)].map((match) => Number(match[1]))
              );
              const added = numbers.filter((number) => !references.has(number));
              pullRequest.body += `${pullRequest.body ? '\n\n' : ''}${added.map((number) => `Related to #${number}`).join('\n')}`;
              return {
                ok: true,
                pullRequestNumber: pullRequest.number,
                linkedAnalysisIssueNumbers: message.analysisIssueNumbers,
                linkedCountermeasureIssueNumbers: message.countermeasureIssueNumbers,
              };
            }
            if (message.type === 'LINK_COUNTERMEASURE_ISSUES') {
              for (const number of message.countermeasureIssueNumbers) {
                const issue = state().countermeasureIssues.find((item) => item.number === number);
                if (issue && !issue.body.includes(`#${message.analysisIssueNumber}`)) {
                  issue.body += `\n\nRelated analysis result: #${message.analysisIssueNumber}`;
                }
              }
              return {
                ok: true,
                analysisIssueNumber: message.analysisIssueNumber,
                linkedIssueNumbers: message.countermeasureIssueNumbers,
              };
            }
            return { ok: false, error: `Unsupported test message: ${message.type}` };
          },
        },
      };
    }, { runtimeBaseUrl: baseUrl });
  }

  setLinkedIssues({ analysisNumbers = [2], countermeasureNumber = 10, pullRequestNumber = 20 }) {
    this.fixtures.analysisIssues = analysisNumbers.map((number) => createIssue(
      number,
      `Analysis result ${number}`,
      'analysis_result',
      `### analysis result\n* Failure Mode: Failure mode ${number}\n* Severity: 8`
    ));
    this.fixtures.countermeasureIssues = [createIssue(
      countermeasureNumber,
      `Countermeasure ${countermeasureNumber}`,
      'countermeasure',
      `### countermeasure\n* Content: Countermeasure content\n* Effect(Effect): Improved reliability\n* RPN: 16\n* Related analysis result: ${analysisNumbers.map((number) => `#${number}`).join(', ')}`
    )];
    this.fixtures.pullRequests = [{
      number: pullRequestNumber,
      title: `Pull request ${pullRequestNumber}`,
      body: `Related to ${[...analysisNumbers, countermeasureNumber].map((number) => `#${number}`).join('\nRelated to ')}`,
      html_url: `https://github.com/octo-org/demo-repo/pull/${pullRequestNumber}`,
    }];
  }

  setUnlinkedPullRequest(pullRequestNumber = 20) {
    this.fixtures.pullRequests = [{
      number: pullRequestNumber,
      title: `Pull request ${pullRequestNumber}`,
      body: '',
      html_url: `https://github.com/octo-org/demo-repo/pull/${pullRequestNumber}`,
    }];
  }
}

setDefaultTimeout(15000);
setWorldConstructor(IssueMapWorld);

Before(async function () {
  await this.startServer();
  await this.startPage();
});

After(async function () {
  await this.context?.close();
  await this.browser?.close();
  if (this.server) {
    await new Promise((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

export { createIssue };
