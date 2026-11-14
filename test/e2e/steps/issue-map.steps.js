import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { createIssue } from '../support/world.js';

Given('the repository has Analysis Result issue {int} and Countermeasure issue {int} linked to it', function (analysisNumber, countermeasureNumber) {
  this.setLinkedIssues({ analysisNumbers: [analysisNumber], countermeasureNumber });
});

Given('pull request {int} references issues {int} and {int}', function (pullRequestNumber, analysisNumber, countermeasureNumber) {
  this.setLinkedIssues({
    analysisNumbers: [analysisNumber],
    countermeasureNumber,
    pullRequestNumber,
  });
});

Given('the repository has Analysis Results {int} and {int} and Countermeasure {int} linked to both', function (firstAnalysisNumber, secondAnalysisNumber, countermeasureNumber) {
  this.fixtures.analysisIssues = [firstAnalysisNumber, secondAnalysisNumber].map((number) => createIssue(
    number,
    `Analysis result ${number}`,
    'analysis_result',
    `### analysis result\n* Failure Mode: Failure mode ${number}\n* Severity: 8`
  ));
  this.fixtures.countermeasureIssues = [createIssue(
    countermeasureNumber,
    `Countermeasure ${countermeasureNumber}`,
    'countermeasure',
    `### countermeasure\n* Content: Countermeasure content\n* Effect(Effect): Improved reliability\n* RPN: 16\n* Related analysis result: #${firstAnalysisNumber}, #${secondAnalysisNumber}`
  )];
});

Given('pull request {int} references issues {int}, {int}, and {int}', function (pullRequestNumber, firstAnalysis, secondAnalysis, countermeasure) {
  this.fixtures.pullRequests = [{
    number: pullRequestNumber,
    title: `Pull request ${pullRequestNumber}`,
    body: `Related to analysis result #${firstAnalysis}\nRelated to analysis result #${secondAnalysis}\nRelated to countermeasure #${countermeasure}`,
    html_url: `https://github.com/octo-org/demo-repo/pull/${pullRequestNumber}`,
  }];
});

Given('the repository has Analysis Result issue {int} and Countermeasures {int} and {int} linked to it', function (analysisNumber, firstCountermeasure, secondCountermeasure) {
  this.fixtures.analysisIssues = [createIssue(
    analysisNumber,
    `Analysis result ${analysisNumber}`,
    'analysis_result',
    `### analysis result\n* Failure Mode: Failure mode ${analysisNumber}\n* Severity: 8`
  )];
  this.fixtures.countermeasureIssues = [firstCountermeasure, secondCountermeasure].map((number) => (
    createIssue(
      number,
      `Countermeasure ${number}`,
      'countermeasure',
      `### countermeasure\n* Content: Countermeasure content ${number}\n* Related analysis result: #${analysisNumber}`
    )
  ));
});

Given('pull request {int} references Analysis Result {int} and Countermeasures {int} and {int}', function (pullRequestNumber, analysisNumber, firstCountermeasure, secondCountermeasure) {
  this.fixtures.pullRequests = [{
    number: pullRequestNumber,
    title: `Pull request ${pullRequestNumber}`,
    body: `Related to analysis result #${analysisNumber}\nRelated to countermeasure #${firstCountermeasure}\nRelated to countermeasure #${secondCountermeasure}`,
    html_url: `https://github.com/octo-org/demo-repo/pull/${pullRequestNumber}`,
  }];
});

Given('the repository has no labeled issues or pull requests', function () {
  this.fixtures.analysisIssues = [];
  this.fixtures.countermeasureIssues = [];
  this.fixtures.pullRequests = [];
});

Given('the repository page does not have a Pull requests navigation tab', function () {
  this.fixtures.analysisIssues = [];
  this.fixtures.countermeasureIssues = [];
  this.fixtures.pullRequests = [];
});

Given('pull request {int} has no issue references', function (pullRequestNumber) {
  this.setUnlinkedPullRequest(pullRequestNumber);
});

When('I open the Issues Map', async function () {
  await this.openIssueMap();
});

When('the content script is loaded there with the Issues Map route active', async function () {
  await this.openRepositoryPageWithoutPullRequestsNavigation();
});

When('I go back to the repository page', async function () {
  await this.page.goBack();
});

When('I edit Analysis Result issue {int} from its number link', async function (issueNumber) {
  await this.page.locator(`a[aria-label*="(#${issueNumber})"]`).click();
  const drawer = this.page.getByRole('dialog', { name: `Issue #${issueNumber} details` });
  await drawer.getByRole('textbox', { name: 'Issue title' }).fill('Updated analysis title');
  await drawer.getByRole('textbox', { name: 'Issue body' }).fill(
    '### analysis result\n* Failure Mode: Updated failure mode\n* Severity: 8'
  );
  await drawer.getByRole('button', { name: 'Save changes' }).click();
  await drawer.getByText('Changes saved. Refreshing the Issue Map.').waitFor();
});

When('I create a Countermeasure titled {string}', async function (title) {
  await this.page.getByRole('link', { name: 'Create countermeasure', exact: true }).click();
  const drawer = this.page.getByRole('dialog', { name: 'Create a countermeasure' });
  await drawer.getByRole('textbox', { name: 'Issue title' }).fill(title);
  await drawer.getByRole('button', { name: 'Create issue' }).click();
  await drawer.getByText('Issue created.').waitFor();
});

When('I link the pull request in the map to the displayed issues', async function () {
  await this.page.getByRole('button', { name: 'Link', exact: true }).last().click();
  const drawer = this.page.getByRole('dialog', { name: 'Link a pull request to issues' });
  await drawer.getByLabel('Pull request').selectOption('20');
  const fetchCountsBeforeSave = await this.page.evaluate(() => ({
    issueMap: window.__issueMapTestState.issueMapFetchCount,
    pullRequests: window.__issueMapTestState.pullRequestFetchCount,
  }));
  await drawer.getByRole('button', { name: 'Save issue links' }).click();
  await drawer.getByText(/Linked pull request #20/).waitFor();
  const fetchCountsAfterSave = await this.page.evaluate(() => ({
    issueMap: window.__issueMapTestState.issueMapFetchCount,
    pullRequests: window.__issueMapTestState.pullRequestFetchCount,
  }));
  assert.deepEqual(fetchCountsAfterSave, fetchCountsBeforeSave);
  assert.equal(
    await this.page.locator('#issue-map-view-table a[href*="/pull/20"]').count(),
    1,
    'The map should show the linked PR immediately without fetching the map again'
  );
  const updatedBody = await this.page.evaluate(
    () => window.__issueMapTestState.pullRequests[0].body
  );
  assert.match(updatedBody, /Related to analysis result #2/);
  assert.match(updatedBody, /Related to countermeasure #10/);
  assert.match(updatedBody, /<!-- Issue Map relationship guidance/);
  assert.match(updatedBody, /Related to countermeasure #<number>/);
});

Then('the Analysis Result, Countermeasure, and pull request are shown in one row', async function () {
  const row = this.page.locator('#issue-map-view-table tbody tr').filter({ hasText: '#20' });
  await row.waitFor();
  assert.match(await row.innerText(), /Failure mode 2/);
  assert.match(await row.innerText(), /Countermeasure content/);
  assert.equal(await row.getByRole('link', { name: /#20/ }).count(), 1);
});

Then('the one-to-one relationship warning is displayed', async function () {
  await this.page.getByRole('note').getByText(/Countermeasures and PRs are expected to have a 1:1 relationship/).waitFor();
});

Then('the one-to-one relationship warning is hidden', async function () {
  assert.equal(await this.page.getByRole('note').count(), 0);
});

Then('the repository content is visible and the Issues Map is closed', async function () {
  await this.page.locator('#repository-content').waitFor({ state: 'visible' });
  assert.equal(await this.page.locator('#issue-map-view-table').count(), 0);
});

Then('the Issues Map tab and view are not displayed', async function () {
  assert.equal(await this.page.getByRole('tab', { name: 'Issues Map' }).count(), 0);
  assert.equal(await this.page.locator('#issue-map-view-table').count(), 0);
});

Then('removed Countermeasure fields are not displayed', async function () {
  const table = this.page.locator('#issue-map-view-table');
  for (const label of ['Status', 'Owner', 'Deadline']) {
    assert.equal(await table.getByRole('columnheader', { name: label, exact: true }).count(), 0);
  }
});

Then('pull request {int} is shown once for Analysis Result {int} and once for Analysis Result {int}', async function (pullRequestNumber, firstAnalysis, secondAnalysis) {
  const rows = this.page.locator('#issue-map-view-table tbody tr').filter({ hasText: `#${pullRequestNumber}` });
  assert.equal(await rows.count(), 2);
  const rowText = await rows.allInnerTexts();
  assert.equal(rowText.filter((text) => text.includes(`Failure mode ${firstAnalysis}`)).length, 1);
  assert.equal(rowText.filter((text) => text.includes(`Failure mode ${secondAnalysis}`)).length, 1);
});

Then('the creation succeeds and the new Countermeasure appears in the map', async function () {
  await this.page.getByRole('link', { name: /#100/ }).waitFor();
  const createdTitle = await this.page.evaluate(
    () => window.__issueMapTestState.countermeasureIssues[0].title
  );
  assert.equal(createdTitle, 'Replace the bearing');
});

Then('the changed issue content appears in the map', async function () {
  await this.page.locator('#issue-map-view-table tbody tr')
    .filter({ hasText: 'Updated failure mode' })
    .waitFor();
});

Then('pull request {int} is shown in the linked issue row', async function (pullRequestNumber) {
  await this.page.locator('#issue-map-view-table tbody tr')
    .filter({ hasText: `#${pullRequestNumber}` })
    .waitFor();
});
