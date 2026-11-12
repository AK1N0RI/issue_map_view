import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAnalysisResult,
  parseCountermeasure,
  buildIssueCreateUrl,
  buildIssueCreateApiRequest,
  addAnalysisIssueReference,
  getAnalysisIssueNumbers,
  updateAnalysisIssueReferences,
  groupCountermeasuresByAnalysis,
  buildIssueListUrl,
  deriveCountermeasureStatus,
} from '../src/lib/issue-map.js';

test('parseAnalysisResult extracts structured fields from markdown', () => {
  const markdown = `
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
`;

  const result = parseAnalysisResult(markdown);

  assert.equal(result.failureMode, 'the motor does not start');
  assert.equal(result.failureCause, 'a component is damaged');
  assert.equal(result.failureCategory, 'mechanical failure');
  assert.equal(result.prevention, 'replace the component regularly');
  assert.equal(result.detectionMethod, 'inspect the component regularly');
  assert.equal(result.effect, 'the system stops when the motor fails');
  assert.equal(result.severity, 9);
  assert.equal(result.occurrence, 7);
  assert.equal(result.detection, 3);
});

test('parseAnalysisResult ignores bullets outside its section and leaves missing scores blank', () => {
  const result = parseAnalysisResult(`
* Failure Mode: unrelated section
### analysis result
* Failure Mode: issue title details
* Failure Cause: worn bearing
### notes
* Severity: 9
`);

  assert.equal(result.failureMode, 'issue title details');
  assert.equal(result.failureCause, 'worn bearing');
  assert.equal(result.severity, '');
});

test('parseAnalysisResult reads fields without a heading and accepts markdown formatting', () => {
  const result = parseAnalysisResult(`
- **Failure Mode**: motor does not start
| Failure Cause | worn bearing |
| **Severity** | 9 |
`);

  assert.equal(result.failureMode, 'motor does not start');
  assert.equal(result.failureCause, 'worn bearing');
  assert.equal(result.severity, 9);
});

test('parseAnalysisResult reads the English fields from the creation template', () => {
  const result = parseAnalysisResult(`
### analysis result
<!-- do not edit predefined fields -->
* Failure Mode: motor does not start
* Failure Cause: worn bearing
* Failure Classification: mechanical
* Preventive Measure: replace bearing
* Detection Method: monthly inspection
* Effect: production stops
* Severity: 9
* Occurrence: 7
* Detection: 3
`);

  assert.deepEqual(result, {
    failureMode: 'motor does not start',
    failureCause: 'worn bearing',
    failureCategory: 'mechanical',
    prevention: 'replace bearing',
    detectionMethod: 'monthly inspection',
    effect: 'production stops',
    severity: 9,
    occurrence: 7,
    detection: 3,
  });
});

test('parseCountermeasure extracts measure data from markdown', () => {
  const markdown = `
### countermeasure
* Content: replace the component regularly
* Effect(Effect): the system continues operating
* Effect(Occurrence): 7
* Effect(Detection): 3
* RPN: 189
* Owner: A. Example
* Deadline: 2026-12-31
`;

  const result = parseCountermeasure(markdown);

  assert.equal(result.content, 'replace the component regularly');
  assert.equal(result.effectImpact, 'the system continues operating');
  assert.equal(result.effectOccurrence, 7);
  assert.equal(result.effectDetection, 3);
  assert.equal(result.rpn, 189);
  assert.equal(result.owner, 'A. Example');
  assert.equal(result.deadline, '2026-12-31');
});

test('parseCountermeasure reads the English fields from the creation template', () => {
  const result = parseCountermeasure(`
### countermeasure
<!-- do not edit predefined fields -->
* Content: replace the bearing regularly
* Effect(Effect): production continues
* Effect(Occurrence): 2
* Effect(Detection): 1
* RPN: 18
* Status: <!-- insert countermeasure status -->
* Owner: <!-- insert countermeasure owner -->
* Deadline: <!-- insert countermeasure deadline -->
`);

  assert.deepEqual(result, {
    content: 'replace the bearing regularly',
    effectImpact: 'production continues',
    effectOccurrence: 2,
    effectDetection: 1,
    rpn: 18,
    owner: '',
    deadline: '',
  });
});

test('parseCountermeasure reads markdown fields without a section heading', () => {
  const result = parseCountermeasure(`
- **Content**: replace the bearing
- Effect(Effect): production continues
- RPN: 18
`);

  assert.equal(result.content, 'replace the bearing');
  assert.equal(result.effectImpact, 'production continues');
  assert.equal(result.rpn, 18);
});

test('buildIssueCreateUrl adds the analysis_result label for issue creation', () => {
  const url = buildIssueCreateUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'analysis_result',
  });

  const parsedUrl = new URL(url);
  assert.equal(parsedUrl.origin + parsedUrl.pathname, 'https://github.com/octo-org/demo-repo/issues/new');
  assert.equal(parsedUrl.searchParams.get('labels'), 'analysis_result');
  assert.equal(parsedUrl.searchParams.get('body'), `### analysis result
<!-- do not edit predefined fields -->
* Failure Mode: <!-- insert failure mode -->
* Failure Cause: <!-- insert failure cause -->
* Failure Classification: <!-- insert failure classification -->
* Preventive Measure: <!-- insert preventive measure -->
* Detection Method: <!-- insert detection method -->
* Effect: <!-- insert effect -->
* Severity: <!-- insert severity -->
* Occurrence: <!-- insert occurrence -->
* Detection: <!-- insert detection -->`);
});

test('buildIssueCreateUrl adds the countermeasure template and label', () => {
  const url = new URL(buildIssueCreateUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'countermeasure',
  }));

  assert.equal(url.origin + url.pathname, 'https://github.com/octo-org/demo-repo/issues/new');
  assert.equal(url.searchParams.get('labels'), 'countermeasure');
  assert.equal(url.searchParams.get('body'), `### countermeasure
<!-- do not edit predefined fields -->
* Content: <!-- insert countermeasure content -->
* Effect(Effect): <!-- insert countermeasure effect on effect -->
* Effect(Occurrence): <!-- insert countermeasure effect on occurrence -->
* Effect(Detection): <!-- insert countermeasure effect on detection -->
* RPN: <!-- insert countermeasure RPN -->
* Status: <!-- insert countermeasure status -->
* Owner: <!-- insert countermeasure owner -->
* Deadline: <!-- insert countermeasure deadline -->`);
});

test('buildIssueCreateUrl includes a supplied title and body', () => {
const url = new URL(buildIssueCreateUrl({
  owner: 'octo-org',
  repo: 'demo-repo',
  type: 'analysis_result',
  title: 'Motor failure',
  body: '### analysis result\n* Failure Mode: Motor does not start',
}));

assert.equal(url.searchParams.get('labels'), 'analysis_result');
assert.equal(url.searchParams.get('title'), 'Motor failure');
assert.equal(url.searchParams.get('body'), '### analysis result\n* Failure Mode: Motor does not start');
});

test('buildIssueCreateApiRequest sends analysis results to the GitHub Issues API', () => {
  assert.deepEqual(buildIssueCreateApiRequest({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'analysis_result',
    title: '  Motor failure  ',
    body: '### analysis result',
  }), {
    url: 'https://api.github.com/repos/octo-org/demo-repo/issues',
    method: 'POST',
    payload: {
      title: 'Motor failure',
      body: '### analysis result',
      labels: ['analysis_result'],
    },
  });
});

test('buildIssueCreateApiRequest applies the countermeasure label', () => {
  const request = buildIssueCreateApiRequest({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'countermeasure',
    title: 'Replace bearing',
    body: '### countermeasure',
  });

  assert.deepEqual(request.payload.labels, ['countermeasure']);
});

test('addAnalysisIssueReference adds the related analysis issue to a countermeasure body', () => {
  assert.equal(
    addAnalysisIssueReference('### countermeasure\n* Content: replace bearing\n', 42),
    '### countermeasure\n* Content: replace bearing\n\nRelated analysis result: #42'
  );
});

test('addAnalysisIssueReference leaves unassociated countermeasure bodies unchanged', () => {
  const body = '### countermeasure\n* Content: replace bearing';
  assert.equal(addAnalysisIssueReference(body, null), body);
});

test('updateAnalysisIssueReferences appends links once and writes issue numbers in ascending order', () => {
  assert.equal(
    updateAnalysisIssueReferences(
      '### countermeasure\n* Content: replace bearing\n\nRelated analysis result: #4; #2',
      [8, 2]
    ),
    '### countermeasure\n* Content: replace bearing\n\nRelated analysis result: #2, #4, #8'
  );
  assert.deepEqual(
    getAnalysisIssueNumbers('Related analysis result: #2, #4; #8'),
    [2, 4, 8]
  );
});

test('groupCountermeasuresByAnalysis maps one analysis issue to multiple countermeasures', () => {
  const analysisIssues = [{ number: 12 }, { number: 34 }];
  const countermeasureIssues = [
    { number: 101, body: '### countermeasure\n* Related analysis result: #12' },
    { number: 102, body: '### countermeasure\nRelated analysis result: #12' },
    { number: 103, body: '### countermeasure\nRelated analysis result: #34' },
  ];

  const result = groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues);

  assert.deepEqual(result.groups.map(({ analysisIssue, countermeasureIssues: linked }) => [
    analysisIssue.number,
    linked.map((issue) => issue.number),
  ]), [
    [12, [101, 102]],
    [34, [103]],
  ]);
  assert.deepEqual(result.unlinkedCountermeasures, []);
});

test('groupCountermeasuresByAnalysis keeps missing and unknown references separate', () => {
  const analysisIssues = [{ number: 12 }];
  const countermeasureIssues = [
    { number: 101, body: '### countermeasure\nRelated analysis result: #12' },
    { number: 102, body: '### countermeasure\nRelated analysis result: #99' },
    { number: 103, body: '### countermeasure' },
  ];

  const result = groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues);

  assert.deepEqual(result.groups.map(({ analysisIssue, countermeasureIssues: linked }) => [
    analysisIssue.number,
    linked.map((issue) => issue.number),
  ]), [[12, [101]]]);
  assert.deepEqual(result.unlinkedCountermeasures.map((issue) => issue.number), [102, 103]);
});

test('groupCountermeasuresByAnalysis links one countermeasure to every referenced analysis issue', () => {
  const analysisIssues = [{ number: 2 }, { number: 4 }, { number: 6 }, { number: 8 }];
  const countermeasureIssues = [
    { number: 101, body: 'Related analysis result: #2, #4' },
    { number: 102, body: 'Related analysis result: #2; #6' },
    { number: 103, body: 'Related analysis result: #4 #8' },
    { number: 104, body: 'Related analysis result: #2 - #8' },
    { number: 105, body: 'Related analysis result: #2, #2, #4' },
  ];

  const result = groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues);

  assert.deepEqual(result.groups.map(({ analysisIssue, countermeasureIssues: linked }) => [
    analysisIssue.number,
    linked.map((issue) => issue.number),
  ]), [
    [2, [101, 102, 104, 105]],
    [4, [101, 103, 105]],
    [6, [102]],
    [8, [103, 104]],
  ]);
  assert.deepEqual(result.unlinkedCountermeasures, []);
});

test('buildIssueListUrl filters the repository issues by label', () => {
  const url = buildIssueListUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'countermeasure',
  });

  assert.equal(
    url,
    'https://github.com/octo-org/demo-repo/issues?q=label%3A%22countermeasure%22'
  );
});

test('deriveCountermeasureStatus maps PR status into completed, pending, and not started states', () => {
  assert.equal(deriveCountermeasureStatus({ merged: true }), 'Complete');
  assert.equal(deriveCountermeasureStatus({ merged: false, hasPullRequest: true }), 'In progress');
  assert.equal(deriveCountermeasureStatus({ merged: false, hasPullRequest: false }), 'Not started');
});
