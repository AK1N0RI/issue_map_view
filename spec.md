This document describes the functionality provided by this software.

This Chrome extension uses GitHub features to represent FMEA, risk assessment, and FTA information.
Items marked with `*` describe external behavior. Items marked with `**` describe implementation details.

## Navigation

* The extension provides a spreadsheet-like table for FMEA, consisting of Analysis Result and Countermeasure columns.
* An "Issues Map" menu item is added beside the Code and Issues tabs on GitHub repository pages.
* Selecting Issues Map displays it as a standalone view while preserving repository navigation; it is not appended below the existing repository page.
* Browser back and forward navigation returns to the previous view, and opening the URL directly displays the same view.
* **Use a Manifest V3 content script to modify the GitHub DOM.**
* **Find the repository navigation containing Code, Issues, and Pull requests, then insert an Issues Map link between Issues and Pull requests.**
* **Use the existing tab role and link styling, avoid duplicate menu items by ID, and use a MutationObserver if the navigation is not ready at initial render.**
* The menu and Issues Map view follow GitHub's repository navigation, page, and footer styles. Use a table-like icon; do not override the menu's text color, background, or border. GitHub's default selected state is used.
* Selecting the menu navigates to the `#issue-map-view` route, hides the original repository content, and retains repository navigation and GitHub's shared layout.

## Issue Map

* Display Analysis Results and Countermeasures in a spreadsheet-like table styled like GitHub's issue pages, with approximately two-thirds of their font size.
* The first row contains the columns "Analysis Result Number", "Analysis Result", "Countermeasure Number", and "Countermeasure".
* The second row contains field headings. Analysis Result fields are "Failure Mode", "Failure Cause", "Failure Classification", "Preventive Measure", "Detection Method", "Effect", "Severity", "Occurrence", and "Detection". Countermeasure fields are "Content", "Effect(Effect)", "Effect(Occurrence)", "Effect(Detection)", "RPN", "Status", "Owner", and "Deadline".
* Starting with the third row, cells display values parsed from each GitHub issue body. If the Analysis Result's Failure Mode or Countermeasure's Content is missing, display the issue title instead.
* Display each issue number as a link. Selecting it opens the issue drawer without navigating away. The drawer displays the title, body, labels, assignees, Projects v2, milestone, and change history. The title, body, labels, assignees, Projects v2, and milestone can be edited and saved.
* Link Countermeasures to Analysis Results using issue numbers in the Countermeasure body after `Related analysis result:`. Do not infer relationships from issue number order or row position. Multiple issue numbers may be separated by commas, semicolons, spaces, or hyphens. Display a Countermeasure in the row of every referenced Analysis Result. Multiple Countermeasures may link to one Analysis Result. Countermeasures with no valid existing references appear in standalone rows with an empty Analysis Result cell.
* The "Link" button opens a GitHub-styled drawer listing issues labeled `countermeasure`. Select the Analysis Result and one or more Countermeasures, then choose "Link selected countermeasures" to save the Analysis Result issue number in each selected Countermeasure body. Preserve existing links, remove duplicates, and sort numbers in ascending order using the format `Related analysis result: #2, #4`. When opened from a row, preselect that row's Analysis Result.

### Analysis Results

* Each Analysis Result is a GitHub issue labeled `analysis_result`.
* Each Countermeasure is a GitHub issue labeled `countermeasure`.
* Create the `analysis_result` and `countermeasure` labels in the repository before using issue creation.
* Analysis Result issues use a `### analysis result` heading and fields such as:

```markdown
### analysis result
* Failure Mode: the motor does not start
* Failure Cause: a component is damaged
* Failure Classification: mechanical failure
* Preventive Measure: replace the component regularly
* Detection Method: inspect the component regularly
* Effect: the system stops when the motor fails
* Severity: 9
* Occurrence: 7
* Detection: 3
```

### Countermeasures

* Countermeasure rows display the issue number, fields from the `countermeasure` section, and the status of linked pull requests.
* A merged linked pull request sets Status to "Complete"; an unmerged pull request sets it to "In progress"; no linked pull request sets it to "Not started". If the status cannot be retrieved, keep the issue visible and display "Unavailable".
* Countermeasure issues use a `### countermeasure` heading and fields such as:

```markdown
### countermeasure
* Content: replace the component regularly
* Effect(Effect): the system continues operating
* Effect(Occurrence): 7
* Effect(Detection): 3
* RPN: 189
* Status:
* Owner:
* Deadline:
```

### Listing and issue actions

* Initially, both Analysis Result and Countermeasure columns are visible and empty. Empty cells provide "Create new" and "Link" actions.
* Display a top-level "Create new" button for each issue type regardless of whether matching issues already exist.
* If one issue type has more issues than the other, show a "Create new" action in each unmatched row.
* Do not show a manual refresh button. Fetch issues from the GitHub REST API with a fine-grained PAT and categorize them by the `analysis_result` and `countermeasure` labels. Cache results for five minutes in the browser session and reuse them when returning to the Issue Map. Update the cache after issue creation, editing, and linking so changes appear immediately. Fetch pull request statuses concurrently to reduce latency. If listing issues fails, show the error and keep the top-level creation buttons available.
* Selecting "Create new" opens an issue creation form in the drawer. The title and body are editable. Create the issue through the GitHub REST API with the appropriate label and show success without navigating away. Authenticate with a fine-grained PAT that has Issues: Read and write permission for the target repository; keep it only for the browser session.
* The Issue Map's "Link" action opens a drawer for linking issues instead of navigating to GitHub's issue list.

### Creating Analysis Result issues

* Selecting "Create new" in the Analysis Result column opens the issue creation form in a drawer with the `analysis_result` label applied.
* The default body is:

```markdown
### analysis result
<!-- do not edit predefined fields -->
* Failure Mode: <!-- insert failure mode -->
* Failure Cause: <!-- insert failure cause -->
* Failure Classification: <!-- insert failure classification -->
* Preventive Measure: <!-- insert preventive measure -->
* Detection Method: <!-- insert detection method -->
* Effect: <!-- insert effect -->
* Severity: <!-- insert severity -->
* Occurrence: <!-- insert occurrence -->
* Detection: <!-- insert detection -->
```

### Creating Countermeasure issues

* Selecting "Create new" in an Analysis Result row opens the Countermeasure creation form in a drawer and adds that Analysis Result number to the body as `Related analysis result: #<issue number>`. Top-level creation and any creation not associated with a specific Analysis Result omit this reference.
* Selecting "Create new" in the Countermeasure column opens the issue creation form in a drawer with the `countermeasure` label applied.
* The default body is:

```markdown
### countermeasure
<!-- do not edit predefined fields -->
* Content: <!-- insert countermeasure content -->
* Effect(Effect): <!-- insert countermeasure effect on effect -->
* Effect(Occurrence): <!-- insert countermeasure effect on occurrence -->
* Effect(Detection): <!-- insert countermeasure effect on detection -->
* RPN: <!-- insert countermeasure RPN -->
* Status: <!-- insert countermeasure status -->
* Owner: <!-- insert countermeasure owner -->
* Deadline: <!-- insert countermeasure deadline -->
```
