# Issue Map View

Issue Map View is a Chrome extension for GitHub repositories that visualizes FMEA-style analysis and countermeasure information using labeled GitHub issues.

## Features

- Adds an Issues Map panel to repository pages
- Uses `analysis_result` and `countermeasure` issue labels
- Opens issue creation and issue list screens from blank cells
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

Issue creation uses the GitHub REST API from the extension service worker. Create a fine-grained personal access token for the target repository with **Issues: Read and write** permission, then open the extension's **Details > Extension options** page (or its popup), enter the token, and select **PATを保存**. The token is kept in `chrome.storage.session` and is cleared when the browser session ends or the extension is reloaded.

This configuration uses a personal access token, not GitHub App authentication. A GitHub App flow would require a secure server to hold its private key and issue installation tokens.
