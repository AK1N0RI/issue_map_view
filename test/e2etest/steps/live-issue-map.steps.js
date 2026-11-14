import { After, Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promptLine, promptSecret } from '../support/prompts.js';

const testDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDirectory = path.resolve(testDirectory, '../..');
const repository = { owner: 'AK1N0RI', name: 'issue_map_test' };
const repositoryUrl = `https://github.com/${repository.owner}/${repository.name}`;
const titlePrefix = '[Issue Map live E2E]';
const analysisBody = `### analysis result
* Failure Mode: Live E2E failure mode
* Failure Cause: Live E2E test fixture
* Failure Classification: Test
* Preventive Measure: Not applicable
* Detection Method: Automated browser test
* Effect: No production impact
* Severity: 1
* Occurrence: 1
* Detection: 1`;

setDefaultTimeout(15 * 60 * 1000);

async function waitForExtensionWorker(context) {
  const existingWorker = context.serviceWorkers().find(
    (worker) => worker.url().startsWith('chrome-extension://')
  );
  const worker = existingWorker || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).hostname;
  assert.ok(extensionId, 'The unpacked extension service worker did not start');
  return extensionId;
}

async function openIssueMap(page) {
  await page.goto(`${repositoryUrl}/issues`);
  assert.equal(new URL(page.url()).hostname, 'github.com');
  await page.getByRole('tab', { name: 'Issues Map' }).waitFor({ timeout: 30000 });
  await page.getByRole('tab', { name: 'Issues Map' }).click();
  await page.locator('#issue-map-view-table').waitFor();
  await page.getByText(/\d+ analysis results,/).waitFor();
}

async function createIssueFromDrawer(page, { type, title, body, trigger }) {
  const createAction = trigger || page.locator(`[data-issue-create-type="${type}"]`).first();
  await createAction.waitFor();
  await createAction.click();
  const drawer = page.getByRole('dialog', {
    name: type === 'analysis_result' ? 'Create an analysis result' : 'Create a countermeasure',
  });
  await drawer.getByRole('textbox', { name: 'Issue title' }).fill(title);
  const bodyInput = drawer.getByRole('textbox', { name: 'Issue body' });
  if (body !== undefined) {
    await bodyInput.fill(body);
  }
  const submittedBody = await bodyInput.inputValue();
  await drawer.getByRole('button', { name: 'Create issue' }).click();
  await drawer.getByText('Issue created.').waitFor({ timeout: 30000 });
  const issueLink = drawer.getByRole('link', { name: 'View the created issue' });
  const issueUrl = await issueLink.getAttribute('href');
  assert.ok(issueUrl, `GitHub did not return the URL for "${title}"`);
  const issueNumber = Number(new URL(issueUrl).pathname.match(/\/issues\/(\d+)$/)?.[1]);
  assert.ok(Number.isInteger(issueNumber) && issueNumber > 0, `Invalid issue URL: ${issueUrl}`);
  return { issueNumber, issueUrl, submittedBody };
}

Given('Chrome is started with the current unpacked Issue Map extension', async function () {
  this.profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'issue-map-live-e2e-'));
  const extensionDirectory = path.join(projectDirectory, 'src');
  this.context = await chromium.launchPersistentContext(this.profileDirectory, {
    channel: 'chrome',
    headless: false,
  });
  this.page = this.context.pages()[0] || await this.context.newPage();
  await this.page.goto('chrome://extensions/');
  await this.page.locator('extensions-manager extensions-toolbar #devMode').click();
  await this.page.locator('extensions-manager extensions-toolbar #loadUnpacked').click();
  console.log(`\nIn Chrome's folder picker, select the unpacked extension folder:\n${extensionDirectory}`);
  await promptLine('Press Enter here after Issue Map View appears on chrome://extensions: ');
  this.extensionId = await waitForExtensionWorker(this.context);
  await this.attach(`Loaded current src/ extension from ${extensionDirectory}`);
});

Given('I sign in to GitHub and configure the PAT for the dedicated repository', async function () {
  await this.page.goto(repositoryUrl);
  console.log('\nSign in to GitHub in the visible Chrome window if needed.');
  await promptLine('Press Enter here after the dedicated repository page is accessible: ');
  await this.page.goto(repositoryUrl);
  assert.ok(!this.page.url().includes('/login'), 'GitHub login is required in the visible Chrome window');
  assert.ok((await this.page.title()).includes(repository.name), 'The dedicated repository is not accessible');

  const pullRequestText = await promptLine('Enter the dedicated pull request number to link: ');
  assert.match(pullRequestText, /^\d+$/, 'Enter a numeric pull request number');
  this.pullRequestNumber = Number(pullRequestText);

  const pat = await promptSecret('Enter the fine-grained PAT (input hidden): ');
  assert.ok(pat, 'A PAT is required for the live GitHub test');
  await this.page.goto(`chrome-extension://${this.extensionId}/options.html`);
  await this.page.locator('#github-pat').fill(pat);
  await this.page.getByRole('button', { name: 'Save token' }).click();
  await this.page.getByText(/Token is configured and valid/, { exact: false }).waitFor({ timeout: 30000 });
  await this.page.goto(repositoryUrl);
  await this.page.getByRole('tab', { name: 'Issues Map' }).waitFor({ timeout: 30000 });
});

When('I open the Issues Map in the dedicated repository', async function () {
  await openIssueMap(this.page);
});

When('I create a marked Analysis Result and its linked Countermeasure', async function () {
  this.runMarker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  this.analysisTitle = `${titlePrefix} Analysis ${this.runMarker}`;
  this.countermeasureTitle = `${titlePrefix} Countermeasure ${this.runMarker}`;

  this.analysis = await createIssueFromDrawer(this.page, {
    type: 'analysis_result',
    title: this.analysisTitle,
    body: analysisBody,
  });
  await this.page.waitForFunction(
    (title) => [...document.querySelectorAll('#issue-map-view-table a[aria-label]')]
      .some((link) => link.getAttribute('aria-label')?.includes(title)),
    this.analysisTitle
  );

  const analysisRow = this.page.locator('#issue-map-view-table tbody tr')
    .filter({ has: this.page.locator(`a[aria-label*="${this.analysisTitle}"]`) });
  const createCountermeasure = analysisRow.locator(
    '[data-issue-create-type="countermeasure"]'
  );
  this.countermeasure = await createIssueFromDrawer(this.page, {
    type: 'countermeasure',
    title: this.countermeasureTitle,
    trigger: createCountermeasure,
  });
  assert.ok(
    this.countermeasure.submittedBody.includes(`#${this.analysis.issueNumber}`),
    'The Countermeasure template should reference the created Analysis Result'
  );
  await this.page.locator(
    `#issue-map-view-table a[aria-label*="${this.countermeasureTitle}"]`
  ).waitFor({ timeout: 30000 });

  await this.attach([
    `Analysis Result: ${this.analysis.issueUrl}`,
    `Countermeasure: ${this.countermeasure.issueUrl}`,
  ].join('\n'));
});

When('I link the created issues to the dedicated pull request', async function () {
  const linkedRow = this.page.locator('#issue-map-view-table tbody tr')
    .filter({ has: this.page.locator(`a[aria-label*="${this.analysisTitle}"]`) });
  await linkedRow.getByRole('button', { name: 'Link', exact: true }).click();
  const drawer = this.page.getByRole('dialog', { name: 'Link a pull request to issues' });
  const pullRequestSelect = drawer.getByLabel('Pull request');
  await pullRequestSelect.selectOption(String(this.pullRequestNumber));
  await drawer.locator(`input[name="analysisIssue"][value="${this.analysis.issueNumber}"]`).check();
  await drawer.locator(`input[name="countermeasureIssue"][value="${this.countermeasure.issueNumber}"]`).check();
  await drawer.getByRole('button', { name: 'Save issue links' }).click();
  await drawer.getByText(new RegExp(`Linked pull request #${this.pullRequestNumber}`)).waitFor({
    timeout: 30000,
  });
  await this.page.waitForFunction(
    ({ analysisTitle, countermeasureTitle, pullRequestNumber }) => {
      const row = [...document.querySelectorAll('#issue-map-view-table tbody tr')]
        .find((candidate) => candidate.querySelector(`a[aria-label*="${analysisTitle}"]`)
          && candidate.querySelector(`a[aria-label*="${countermeasureTitle}"]`));
      return Boolean(row?.querySelector(`a[href*="/pull/${pullRequestNumber}"]`));
    },
    {
      analysisTitle: this.analysisTitle,
      countermeasureTitle: this.countermeasureTitle,
      pullRequestNumber: this.pullRequestNumber,
    },
    { timeout: 30000 }
  );
});

Then('both created issues and the pull request appear together in the Issues Map', async function () {
  const matchingRows = this.page.locator('#issue-map-view-table tbody tr')
    .filter({ has: this.page.locator(`a[aria-label*="${this.analysisTitle}"]`) })
    .filter({ has: this.page.locator(`a[aria-label*="${this.countermeasureTitle}"]`) })
    .filter({ has: this.page.locator(`a[href*="/pull/${this.pullRequestNumber}"]`) });
  assert.equal(await matchingRows.count(), 1);
  await this.attach(`Pull request: ${repositoryUrl}/pull/${this.pullRequestNumber}`);
});

After(async function () {
  try {
    await this.context?.close();
  } finally {
    if (this.profileDirectory) {
      await rm(this.profileDirectory, { recursive: true, force: true });
    }
  }
});
