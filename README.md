# Issue Map View

Issue Map View is a Chrome extension for GitHub repositories that visualizes FMEA-style analysis and countermeasure information using labeled GitHub issues.

## Features

- Adds an Issues Map panel to repository pages
- Uses `analysis_result` and `countermeasure` issue labels
- Opens issue creation and Countermeasure-to-Analysis Result linking drawers from blank cells
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

Issue listing, creation, and metadata editing use the GitHub API from the extension service worker with a fine-grained personal access token. Grant the target repository **Issues: Read and write** permission, **Projects: Read and write** permission for Project v2 membership, and **Pull requests: Read** to show linked pull request status. Open the extension's **Details > Extension options** page (or its popup), enter the token, and select **Save token**. The settings page verifies the token and shows its status and expiration when GitHub provides it. The token is kept in `chrome.storage.session` and is cleared when the browser session ends or the extension is reloaded.

This configuration uses a personal access token, not GitHub App authentication. A GitHub App flow would require a secure server to hold its private key and issue installation tokens.
