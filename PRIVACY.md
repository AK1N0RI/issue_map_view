# Privacy Policy

**Issue Map View**  
**Effective date: November 23, 2026**

Issue Map View is a Chrome extension that displays relationships between GitHub Failure Analysis issues, Countermeasures, and pull requests. This policy explains what information the extension handles and how it is used.

## Information the extension handles

When you use the extension, it may handle:

- **GitHub personal access token (PAT):** The fine-grained token you enter in the extension settings. It is used to authenticate requests to GitHub on your behalf.
- **GitHub account information:** The GitHub username and token expiration information returned by GitHub when you check whether your token is valid. The username and expiration are shown in the extension settings.
- **Repository and GitHub content:** The owner and name of the repository open in GitHub, and issue, pull request, label, assignee, milestone, timeline, and GitHub Projects v2 information needed to display or manage the Issue Map.
- **Content you submit:** Issue titles, descriptions, labels, assignees, project selections, and relationship updates that you choose to create or edit through the extension.

## How information is used and transmitted

The extension uses this information only to provide its Issue Map features: displaying repository information, checking your PAT, and creating, updating, or linking GitHub issues, pull requests, and Projects v2 items when you request those actions.

Requests containing your PAT or GitHub content are sent over HTTPS directly to GitHub's website or API (`github.com` and `api.github.com`). The extension does not send this information to an Issue Map View developer-operated server. GitHub processes information in accordance with [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Issue Map View does not include advertising, analytics, or tracking functionality, and does not sell or share information with data brokers.

## Local storage and retention

The PAT and temporary Issue Map data are stored using Chrome's `storage.session` storage. Issue Map data is cached for up to five minutes for reuse. Session storage is cleared when the browser session ends or the extension is reloaded, disabled, or updated. Removing or changing the PAT also clears the Issue Map cache. The PAT can be removed at any time using **Remove token** in the extension settings.

Information already created or updated in GitHub remains in your GitHub account and is governed by GitHub's policies. To change or delete that information, use GitHub.

## Your choices

- You choose whether to install the extension and whether to provide a PAT.
- You can limit the PAT to the repositories and permissions needed for your use.
- You can remove the PAT from the extension settings or uninstall the extension.
- Issue and project changes are made to GitHub only when you use the corresponding extension action.

## Changes to this policy

If the extension's data handling changes, this policy will be updated before or when the change is released. The effective date above indicates the latest revision.

## Contact

For questions about this policy, contact the project maintainer through the [Issue Map View GitHub repository](https://github.com/AK1N0RI/issue_map_view/issues). Do not post a PAT or other sensitive information in a public issue.
