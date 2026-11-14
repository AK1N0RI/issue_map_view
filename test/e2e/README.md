# Running the E2E tests

## Requirements

- Node.js and npm
- Internet access on the first run so npm can install the test dependencies and Playwright can download Chromium

No GitHub login, PAT, or GitHub repository access is required. The tests use a local repository-page fixture and mocked GitHub responses; they do not make live GitHub requests or modify issues.

## Run the tests

From the repository root, run:

```sh
npm run test:e2e
```

On the first run, the test runner installs dependencies into `test/node_modules` and installs Playwright Chromium if it is missing. Later runs reuse those installations. The test dependencies and browser are separate from the extension source.

To run the E2E suite directly after dependencies and Chromium have been installed, run:

```sh
npm --prefix test run test:e2e
```

## Results

Cucumber prints one dot per completed step and a scenario summary at the end. A successful run reports all scenarios as passed and exits with status `0`. If a scenario fails, Cucumber reports the failed step and exits with a non-zero status.

The scenarios cover Issue Map display and navigation, multiple Analysis Result–Countermeasure–PR relationships, Countermeasure creation, issue editing, and linking an existing pull request. See [`features/issue-map.feature`](./features/issue-map.feature) for the full scenario list.

Cucumber also writes an HTML report to `test/e2e/report.html`. The report is ignored by Git.

## Troubleshooting

- **Dependency installation fails:** Check that npm can access the package registry, then rerun `npm run test:e2e`.
- **Chromium download or launch fails:** Check network access and the Playwright system requirements for your operating system, then rerun the command. The runner retries the browser installation whenever the expected Chromium executable is missing.
- **A test fails:** Review the failed scenario and step in the command output. Test fixtures and Playwright setup are in [`support/world.js`](./support/world.js); step implementations are in [`steps/issue-map.steps.js`](./steps/issue-map.steps.js).
