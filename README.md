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
- `test/` - validation scripts for the issue parsing and URL generation logic

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
