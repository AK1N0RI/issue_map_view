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
