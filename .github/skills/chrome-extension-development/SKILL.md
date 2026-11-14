---
name: chrome-extension-development
description: "Use when: building a Chrome extension add-on, MV3 browser extension, popup/options page, background service worker, content script, or browser automation feature. Includes architecture choices, secure coding standards, and test criteria for production-ready Chrome add-ons."
---

# Chrome Extension Development Skill

## Purpose

Design and implement Chrome extensions that are secure and maintainable, use the minimum necessary permissions, separate responsibilities clearly, and earn users' trust.

## Required skills

This skill covers the following areas:

1. Requirements analysis
   - Clarify the problem the user wants to solve.
   - Define the browser actions and pages in scope.
   - Identify the minimum required permissions and target pages.

2. Architecture design
   - Manifest V3 design.
   - Responsibilities of popup, options, side panel, content script, and service worker.
   - Message passing.
   - Storage and state management.

3. Implementation
   - Separation of background processing and UI.
   - Safe DOM manipulation.
   - Error handling and logging.
   - Auditable module structure.

4. Security and operations
   - Principle of least privilege.
   - Communication and input validation.
   - Avoiding CSP violations and `eval`.
   - Handling known API limitations.

5. Quality assurance
   - Unit, integration, and manual test design.
   - Loading and testing the extension in Chrome.
   - Regression-prevention checklists.

---

## Workflow

### 1. Confirm purpose and scope

- Can the extension's purpose be explained in one sentence?
- Are target pages, tabs, and URLs defined?
- Have required permissions been investigated and unnecessary ones removed?
- Has it been decided whether the feature belongs in the popup, content script, or background?

### 2. Choose the extension architecture

#### Selection criteria

- Is a UI needed?
  - Yes: choose a popup, options page, or side panel.
- Does the feature need to modify page DOM?
  - Yes: use a content script.
- Is continuous background processing needed?
  - Yes: consider a service worker or offscreen document.
- Does the extension need to remember data?
  - Yes: consider `chrome.storage.local` or `chrome.storage.sync`.
- Does it need to call external APIs?
  - Yes: design host permissions and message passing.

#### Common patterns

- Collecting web page information: content script + popup.
- One-click action: action popup + background.
- Notifications or tracking: service worker + storage.
- Configurable extension: options page + storage.

### 3. Finalize the design

- Assume Manifest V3 and minimize `permissions` and `host_permissions`.
- Define message naming conventions and payload formats.
- Separate UI and logic, and clarify which component owns state.
- Plan error recovery and user-facing messages.

### 4. Implement

- Avoid placing too many responsibilities in one file.
- Modularize background, popup, options, and content scripts.
- Follow a consistent policy for localized logs.
- Keep UI event handlers small and extract logic into separate modules.

### 5. Validate

- Load the extension in Chrome as an unpacked extension.
- Check permission, API usage, and DOM dependency errors.
- Reproduce the full workflow manually and test failure cases.
- Run the regression checklist after changes.

---

## Coding standards

### 1. Core principles

- Least privilege: request only permissions that are needed.
- Separation of concerns: keep UI, logic, and persistence separate.
- Safe DOM manipulation: avoid excessive `innerHTML`; validate and escape user input.
- Predictable events: keep message keys and payloads fixed.
- Error recovery: make errors visible in the UI.

### 2. Manifest standards

- Use Manifest V3 whenever possible.
- Require `manifest_version: 3`.
- Grant only permissions required by each feature.
- Limit `host_permissions` to required domains.
- Tighten `content_security_policy` as appropriate.
- Expose only the minimum required `web_accessible_resources`.

### 3. Architecture standards

- Keep the popup focused on concise UI and event listeners.
- Use the background service worker for operations that need to run in the background.
- Use the content script for page-level transformations and avoid putting unrelated UI logic there.
- Use the options page to save and validate settings.
- Centralize storage access behind a lightweight wrapper.

### 4. Implementation standards

- Specify message names with `type` and keep payloads close to a defined schema.
- Do not swallow exceptions; log them appropriately.
- Design retries and timeouts.
- Make trust boundaries explicit when handling signed data or external input.
- Document when server-side validation is required in addition to client-side validation.

### 5. UX and accessibility standards

- Support keyboard interaction on popup and options pages.
- Make important state changes clearly visible.
- Show understandable messages when operations fail.
- Account for states where required APIs are unavailable.

---

## Testing standards

### 1. Unit tests

At minimum, test:

- Message payload transformations.
- Storage save, load, and delete operations.
- URL matching logic.
- Conditional branches and exception handling.
- DOM selection and safe updates.

### 2. Integration tests

- Verify messages from popup to background.
- Check interactions between content scripts and pages.
- Confirm storage persistence behaves as expected.
- Ensure state remains consistent across multiple tabs and pages.

### 3. Browser execution tests

- Load the unpacked extension from `chrome://extensions`.
- Confirm the extension loads without errors.
- Test behavior with sufficient and insufficient permissions.
- Check for significant console errors.

### 4. Manual verification checklist

- Click the extension icon and verify that the popup opens.
- Perform actions in the popup and confirm the expected state changes.
- Confirm that content scripts operate safely on target pages.
- Verify that data is saved in `chrome.storage`.
- Confirm that the UI responds appropriately to invalid input and API errors.
- Confirm that the extension does not behave incorrectly on unsupported pages or URLs.

### 5. Quality gates

- No known critical errors remain.
- Required behavior has been tested.
- Regression tests cover important features.
- Complete when no critical bugs remain.

---

## Completion criteria

A Chrome extension development task is complete when:

- Requirements are documented.
- Permissions are minimized.
- Responsibilities are separated by feature.
- Manifest and message passing structures are clear.
- Major workflows have been tested.
- The extension can be installed and verified in Chrome.
- Failure cases have been checked.

---

## Example prompts

- "I want to build a Chrome extension. Design the Manifest V3 structure for the manifest, popup, background, and content script."
- "Build an extension that injects DOM into a target page. Propose a secure design with minimum permissions."
- "Improve this extension's messaging design and organize the test cases."
- "Create design guidance that defines coding and testing standards for Chrome extensions."

---

## Related customization ideas

- Create `chrome-extension-security` to document permission management and risky API behavior.
- Create `browser-extension-tests` to standardize Playwright and Chrome extension smoke tests.
- Create `extension-release-checklist` to define pre-release verification items.
