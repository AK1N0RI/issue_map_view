# Issue Map View

Issue Map View is a Chrome extension for GitHub repositories that visualizes FMEA-style analysis and countermeasure information using labeled GitHub issues.

## Features

- Adds an Issues Map panel to repository pages
- Uses `analysis_result` and `countermeasure` issue labels
- Displays pull requests linked to Analysis Results and Countermeasures, with one row per issue combination
- Opens issue and pull request linking drawers from the map
- Caches Issue Map data for faster return navigation and updates the cache after edits
- Supports the spec-defined FMEA workflow for analysis and remedy tracking

## Structure

- `src/` - Chrome extension source files
- `test/module/` - isolated Node.js module tests for parsing and relationship logic
- `test/e2e/` - Gherkin feature scenarios and Playwright browser tests

## Run tests

Run all module and mocked browser tests with `npm test`. Run only the module suite with `npm run test:module`, or only the Cucumber/Playwright suite with `npm run test:e2e`. Test dependencies are installed under `test/node_modules`; the runner installs them and Playwright Chromium when needed.

The mocked E2E suite runs against a local fixture and does not log in to GitHub, read a PAT, or make live GitHub requests. No GitHub login is needed for `npm test`.

An opt-in live Chrome/GitHub test is available with `npm run test:live`. It uses the dedicated `AK1N0RI/issue_map_test` repository, creates marked test issues, and updates the pull request number entered at runtime. It uses a temporary Chrome profile, asks for the PAT through a hidden terminal prompt, and removes the profile at the end. It does not save credentials or automatically clean up GitHub changes. Prepare the dedicated repository and review the safety steps in [`test/e2etest/README.md`](./test/e2etest/README.md) before running it. The HTML report is written to `test/e2etest/report.html`.

## Load in Chrome

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `src/` folder

## Create issues with the GitHub API

Issue listing, creation, metadata editing, and PR linking use the GitHub API from the extension service worker with a fine-grained personal access token. Give the token access to the target repository and grant these repository permissions:

- **Issues: Read and write** — list, create, update, and link Analysis Result and Countermeasure issues.
- **Pull requests: Read and write** — list pull requests and add issue references to their descriptions.
- **Projects: Read and write** — view and edit Project v2 membership.

Open the extension's **Details > Extension options** page (or its popup), enter the token, and select **Save token**. The settings page verifies the token and shows its status and expiration when GitHub provides it. The token is kept in `chrome.storage.session` and is cleared when the browser session ends or the extension is reloaded.

This configuration uses a personal access token, not GitHub App authentication. A GitHub App flow would require a secure server to hold its private key and issue installation tokens.
