# Test Plan

## Goals

Validate the Issue Map behavior described in [`../spec.md`](../spec.md) at both the module and browser workflow levels. Tests use synthetic repository data and do not write to GitHub.

## Module tests

Location: `test/module/`

Run with `npm run test:module`. Test-only dependencies are installed in `test/node_modules`, separate from the extension source. The root test runner creates that dependency environment on first use.

Use Node's built-in test runner to verify isolated parsing, URL generation, relationship-reference handling, and row construction. Fixtures cover markdown variations, malformed or unrelated references, duplicate references, multiple Analysis Result–Countermeasure–PR combinations, and standalone issues.

These tests are fast, deterministic, and do not require a browser or network access. Add module tests when changing pure utilities or API request construction.

## End-to-end tests

Location: `test/e2e/`

Run with `npm run test:e2e` or as part of `npm test`. The runner installs Playwright Chromium if it is not already available.

Gherkin scenarios in `e2e/features/` are executed by Cucumber and drive a real Chromium page with Playwright. Each scenario creates a fresh browser context and local fixture server. The tests load the production content script against a repository-page fixture and mock Chrome runtime messages with deterministic data. GitHub API calls are stubbed; no login, PAT, live GitHub account, or repository write access is used.

Scenarios are derived from `spec.md` and cover:

- Issues Map navigation and display of parsed Analysis Result and Countermeasure fields.
- One row for each referenced Analysis Result–Countermeasure–PR combination.
- The PR 1:1 relationship warning and omission of removed Countermeasure fields.
- Countermeasure creation through the drawer and automatic map refresh.
- Selecting an existing PR and linking issues through the drawer.

The test runner provisions the Playwright Chromium browser on first E2E execution if it is not already available.

## Live GitHub E2E tests

Location: `test/e2etest/`.

Run explicitly with `npm run test:live`. This is not included in `npm test`; it launches the installed Google Chrome application, loads the current unpacked extension source in an isolated temporary profile, and uses the real GitHub API against the dedicated `AK1N0RI/issue_map_test` repository. A test creates marked Analysis Result and Countermeasure issues and adds their references to a pull request number entered by the operator. Test-created issues and the PR description change are retained for manual cleanup.

GitHub sign-in is performed manually in the visible browser. The PAT is entered at a hidden terminal prompt and then into the extension options page; neither credential is stored in the repository or report. The temporary browser profile is removed after the scenario, clearing session credentials and cookies. Cucumber writes an HTML report to `test/e2etest/report.html`, which is ignored by Git.

This live test requires explicit operator action and a dedicated repository/PR. The mocked tests remain the safe default for routine validation.

## Coverage and exclusions

The mocked browser workflow validates UI composition, content-script behavior, and message payload effects. It does not certify GitHub's live API permissions, rate limits, rendering changes, or actual repository mutations. Those require a separate manual smoke test in a disposable repository with a suitably scoped PAT entered through the extension options page, never stored in the repository.
