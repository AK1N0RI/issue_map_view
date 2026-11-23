# Issue Map View

[![CI status](https://github.com/AK1N0RI/issue_map_view/actions/workflows/ci.yml/badge.svg)](https://github.com/AK1N0RI/issue_map_view/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/AK1N0RI/issue_map_view?display_name=tag)](https://github.com/AK1N0RI/issue_map_view/releases/latest)

**See the full FMEA story in one place.** Issue Map View is a Chrome extension that turns Failure Analysis issues, Countermeasures, and pull requests into a live, spreadsheet-like map on GitHub repository pages. Follow how a failure connects to its corrective action and implementation PR—without manually piecing together separate issues.

[Privacy policy](./PRIVACY.md)

![Issue Map showing Failure Analyses, Countermeasures, and linked pull requests in a GitHub repository](./img/issues_map.png)

## Why Issue Map?

- **Trace issues to implementation:** See which Countermeasures and pull requests are associated with each Failure Analysis.
- **Understand the relationships at a glance:** Each row brings related GitHub issues and PRs together, including one-to-many relationships.
- **Keep your workflow in GitHub:** Create and link issues and pull requests from drawers in the map, then continue working in the repository.
- **Use the FMEA information you already track:** Failure Mode, Cause, Classification, Preventive Measure, Detection Method, Effect, Severity, Occurrence, and Detection are shown alongside Countermeasure details and RPN.
- **Stay current while editing:** Issue changes update the map, and pull request relationships are reflected when you return to it.

## See it in action

The map groups Failure Analysis fields and Countermeasure fields into a single view. Long content wraps within fixed-width cells and is shortened when needed; hover over a cell to see its full text.

![Failure Analysis and Countermeasure fields displayed together in the Issue Map](./img/image_map2.png)

## How it works

Issue Map View uses GitHub issues as the source of truth:

| GitHub item | Label | Relationship |
| --- | --- | --- |
| Failure Analysis | `failure_analysis` | Identifies the failure mode, cause, risk, and detection information |
| Countermeasure | `countermeasure` | Links to one or more Failure Analyses with `Related failure analysis: #<number>` |
| Pull request | — | Links to issues with `Related to failure analysis #<number>` and `Related to countermeasure #<number>` |

New issues use the `failure_analysis` label and Failure Analysis terminology. Existing issues using the legacy `analysis_result` label, heading, or relationship syntax continue to be recognized.

## Install in Chrome

For local development, clone or download this repository, open `chrome://extensions/` in Chrome, enable **Developer mode**, and select **Load unpacked** to load the `src/` folder. The **Issues Map** tab appears on repository pages with **Code**, **Issues**, and **Pull requests** tabs.

## Releases

The extension version is maintained in both `package.json` and `src/manifest.json`; CI verifies they match. A release is created by pushing a version tag that exactly matches the manifest, for example:

```sh
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions runs tests and security checks before packaging and publishing the GitHub Release. Each release includes `issue-map-view-v<version>.zip`, ready to upload to the Chrome Web Store, and `SHA256SUMS.txt` to verify the package. To submit, download the ZIP from the release and upload it in the Chrome Web Store Developer Dashboard.

Pull requests and pushes to `main`/`master` run the test suites, extension security checks, and a dependency audit. The security checks reject remotely loaded scripts, inline event handlers, dynamic code evaluation, and overly broad web-accessible resources. They help ensure external scripts or macro-like code cannot be silently injected into the extension package.

## Configure GitHub access

To list and modify repository issues and pull requests, configure a fine-grained personal access token in the extension options. Limit the token to the target repository and grant:

- **Issues: Read and write** — list, create, update, and link Failure Analysis and Countermeasure issues.
- **Pull requests: Read and write** — list pull requests and add issue references to their descriptions.
- **Projects: Read and write** — view and edit GitHub Projects v2 membership.

Open the extension's **Details > Extension options** page (or its popup), enter the token, and select **Save token**. The token is stored in `chrome.storage.session` and cleared when the browser session ends or the extension is reloaded.

## Run tests

Run the module, mocked browser, and extension security test suites with:

```sh
npm test
```

Or run an individual suite with `npm run test:module` or `npm run test:e2e`. The mocked E2E suite uses Cucumber, Gherkin, and Playwright; it does not require GitHub login or make live GitHub changes. Test dependencies are installed under `test/node_modules`.

An opt-in live Chrome/GitHub test is available with `npm run test:live`. It uses the dedicated `AK1N0RI/issue_map_test` repository and a temporary Chrome profile. The test creates marked issues and updates a designated pull request; these GitHub changes are not automatically cleaned up. Review [`test/e2etest/README.md`](./test/e2etest/README.md) before running it.

For detailed behavior and relationship formats, see [`spec.md`](./spec.md).
