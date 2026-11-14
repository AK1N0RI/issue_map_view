# Live GitHub E2E test

This opt-in suite uses the installed Google Chrome application and the real GitHub API. It is separate from the deterministic, mocked browser suite in `test/e2e/`.

## Safety and prerequisites

- The test targets only the dedicated repository `AK1N0RI/issue_map_test`.
- Install Google Chrome and use an interactive terminal.
- Make sure you can sign in to the repository in Chrome.
- Prepare an existing pull request in this repository that is safe for the test to update.
- Ensure the repository has the `analysis_result` and `countermeasure` labels. The test creates issues with these labels.
- Use a fine-grained PAT limited to this repository with **Issues: Read and write** and **Pull requests: Read and write** permissions.

The test creates one Analysis Result and one Countermeasure with a unique `[Issue Map live E2E]` title marker, then appends their references to the pull request number you enter. It does not update or delete existing issues, and it does not delete the created test issues or revert the pull request description. Use only the dedicated test repository and a pull request reserved for this test. Remove the marked issues or restore the pull request description manually when finished.

Chrome starts with a temporary, isolated browser profile and opens `chrome://extensions/`. The test enables Developer mode and opens Chrome's **Load unpacked** folder picker; select the `src/` directory printed in the terminal. Because the profile is intentionally new for each run, this installs the current source rather than reusing a possibly stale extension from your normal Chrome profile. The profile, GitHub cookies, and extension session storage (including the PAT) are removed when the test ends. The test does not automate or save your GitHub password. Sign in manually in the visible Chrome window if prompted. The PAT is entered through a hidden terminal prompt, typed into the extension options page, and is never written to a memo, environment file, test report, or repository file.

## Run

From the repository root:

```sh
npm run test:live
```

The runner installs test dependencies under `test/node_modules` if needed. It then opens Chrome and `chrome://extensions/`. Select the current `src/` folder in the native picker; after the extension appears, return to the terminal and press Enter. Then follow the remaining prompts:

1. Sign in to GitHub in Chrome if necessary, open the dedicated repository, and press Enter in the terminal.
2. Enter the number of the dedicated pull request.
3. Enter the PAT at the hidden prompt.
4. Wait for the browser scenario to finish.

The test then configures the PAT in the extension options page, uses the Issues Map to create the marked issues, and links them to the selected pull request.

## HTML report

Cucumber writes the report to `test/e2etest/report.html`. The report is intentionally ignored by Git. It contains scenario results and the created issue/PR URLs, but no credentials.

The existing no-login, mock-only suite remains available with `npm run test:e2e`; run all standard tests with `npm test`. No GitHub writes occur in either of those commands.

## Troubleshooting

- **Chrome does not launch:** Install Google Chrome and rerun the command. This live suite uses Chrome rather than Playwright's bundled Chromium.
- **The repository page is unavailable:** Sign in to the correct GitHub account in the launched Chrome window and confirm that the repository URL opens before pressing Enter.
- **PAT validation fails:** Create a fine-grained token scoped only to this repository and verify the Issues and Pull requests permissions.
- **Issue creation fails:** Confirm both required labels exist in the repository and that the PAT has Issues write permission.
- **PR linking fails:** Confirm the entered number is an existing pull request in this repository and that the PAT has Pull requests write permission.
- **A scenario fails after creating issues:** The test intentionally does not delete GitHub data. Use the unique title marker to find any created issues and inspect the dedicated PR description before manually cleaning up.
