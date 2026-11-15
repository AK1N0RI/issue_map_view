import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFailureAnalysis,
  parseCountermeasure,
  buildIssueCreateUrl,
  buildIssueCreateApiRequest,
  addFailureAnalysisIssueReference,
  getFailureAnalysisIssueNumbers,
  updateFailureAnalysisIssueReferences,
  groupCountermeasuresByFailureAnalysis,
  buildIssueListUrl,
  buildPullRequestCreateUrl,
  getPullRequestIssueNumbers,
  addPullRequestIssueReferences,
  buildIssueMapRows,
} from '../../src/lib/issue-map.js';

test('parseFailureAnalysis extracts structured fields from markdown', () => {
  const markdown = `
### failure analysis
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

  const result = parseFailureAnalysis(markdown);

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

test('parseFailureAnalysis ignores bullets outside its section and leaves missing scores blank', () => {
  const result = parseFailureAnalysis(`
* Failure Mode: unrelated section
### failure analysis
* Failure Mode: issue title details
* Failure Cause: worn bearing
### notes
* Severity: 9
`);

  assert.equal(result.failureMode, 'issue title details');
  assert.equal(result.failureCause, 'worn bearing');
  assert.equal(result.severity, '');
});

test('parseFailureAnalysis reads fields without a heading and accepts markdown formatting', () => {
  const result = parseFailureAnalysis(`
- **Failure Mode**: motor does not start
| Failure Cause | worn bearing |
| **Severity** | 9 |
`);

  assert.equal(result.failureMode, 'motor does not start');
  assert.equal(result.failureCause, 'worn bearing');
  assert.equal(result.severity, 9);
});

test('parseFailureAnalysis reads the English fields from the creation template', () => {
  const result = parseFailureAnalysis(`
### failure analysis
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

test('parseFailureAnalysis continues to read issues with the legacy heading', () => {
  const result = parseFailureAnalysis(
    '### analysis result\n* Failure Mode: legacy content\n### Notes\n* Failure Mode: unrelated'
  );

  assert.equal(result.failureMode, 'legacy content');
});

test('parseCountermeasure extracts measure data from markdown', () => {
  const markdown = `
### countermeasure
* Content: replace the component regularly
* Effect(Effect): the system continues operating
* Effect(Occurrence): 7
* Effect(Detection): 3
* RPN: 189
`;

  const result = parseCountermeasure(markdown);

  assert.equal(result.content, 'replace the component regularly');
  assert.equal(result.effectImpact, 'the system continues operating');
  assert.equal(result.effectOccurrence, 7);
  assert.equal(result.effectDetection, 3);
  assert.equal(result.rpn, 189);
  assert.deepEqual(result, {
    content: 'replace the component regularly',
    effectImpact: 'the system continues operating',
    effectOccurrence: 7,
    effectDetection: 3,
    rpn: 189,
  });
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
`);

  assert.deepEqual(result, {
    content: 'replace the bearing regularly',
    effectImpact: 'production continues',
    effectOccurrence: 2,
    effectDetection: 1,
    rpn: 18,
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

test('buildIssueCreateUrl adds the failure_analysis label for issue creation', () => {
  const url = buildIssueCreateUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'failure_analysis',
  });

  test('buildIssueCreateUrl maps the legacy issue type to the failure_analysis label', () => {
    const url = new URL(buildIssueCreateUrl({
      owner: 'octo-org',
      repo: 'demo-repo',
      type: 'analysis_result',
    }));

    assert.equal(url.searchParams.get('labels'), 'failure_analysis');
  });

  const parsedUrl = new URL(url);
  assert.equal(parsedUrl.origin + parsedUrl.pathname, 'https://github.com/octo-org/demo-repo/issues/new');
  assert.equal(parsedUrl.searchParams.get('labels'), 'failure_analysis');
  assert.equal(parsedUrl.searchParams.get('body'), `### failure analysis
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
* RPN: <!-- insert countermeasure RPN -->`);
});

test('buildIssueCreateUrl includes a supplied title and body', () => {
const url = new URL(buildIssueCreateUrl({
  owner: 'octo-org',
  repo: 'demo-repo',
  type: 'failure_analysis',
  title: 'Motor failure',
  body: '### failure analysis\n* Failure Mode: Motor does not start',
}));

assert.equal(url.searchParams.get('labels'), 'failure_analysis');
assert.equal(url.searchParams.get('title'), 'Motor failure');
assert.equal(url.searchParams.get('body'), '### failure analysis\n* Failure Mode: Motor does not start');
});

test('buildIssueCreateApiRequest sends failure analyses to the GitHub Issues API', () => {
  assert.deepEqual(buildIssueCreateApiRequest({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'failure_analysis',
    title: '  Motor failure  ',
    body: '### failure analysis',
  }), {
    url: 'https://api.github.com/repos/octo-org/demo-repo/issues',
    method: 'POST',
    payload: {
      title: 'Motor failure',
      body: '### failure analysis',
      labels: ['failure_analysis'],
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

test('addFailureAnalysisIssueReference adds the related analysis issue to a countermeasure body', () => {
  assert.equal(
    addFailureAnalysisIssueReference('### countermeasure\n* Content: replace bearing\n', 42),
    '### countermeasure\n* Content: replace bearing\n\nRelated failure analysis: #42'
  );
});

test('addFailureAnalysisIssueReference leaves unassociated countermeasure bodies unchanged', () => {
  const body = '### countermeasure\n* Content: replace bearing';
  assert.equal(addFailureAnalysisIssueReference(body, null), body);
});

test('updateFailureAnalysisIssueReferences appends links once and writes issue numbers in ascending order', () => {
  assert.equal(
    updateFailureAnalysisIssueReferences(
      '### countermeasure\n* Content: replace bearing\n\nRelated failure analysis: #4; #2',
      [8, 2]
    ),
    '### countermeasure\n* Content: replace bearing\n\nRelated failure analysis: #2, #4, #8'
  );
  assert.deepEqual(
    getFailureAnalysisIssueNumbers('Related failure analysis: #2, #4; #8'),
    [2, 4, 8]
  );
});

test('failure analysis references remain readable when stored in the legacy format', () => {
  assert.deepEqual(
    getFailureAnalysisIssueNumbers('Related analysis result: #4, #2'),
    [4, 2]
  );
  assert.equal(
    updateFailureAnalysisIssueReferences('### countermeasure\nRelated analysis result: #4', [2]),
    '### countermeasure\n\nRelated failure analysis: #2, #4'
  );
});

test('groupCountermeasuresByFailureAnalysis maps one analysis issue to multiple countermeasures', () => {
  const analysisIssues = [{ number: 12 }, { number: 34 }];
  const countermeasureIssues = [
    { number: 101, body: '### countermeasure\n* Related failure analysis: #12' },
    { number: 102, body: '### countermeasure\nRelated failure analysis: #12' },
    { number: 103, body: '### countermeasure\nRelated failure analysis: #34' },
  ];

  const result = groupCountermeasuresByFailureAnalysis(analysisIssues, countermeasureIssues);

  assert.deepEqual(result.groups.map(({ analysisIssue, countermeasureIssues: linked }) => [
    analysisIssue.number,
    linked.map((issue) => issue.number),
  ]), [
    [12, [101, 102]],
    [34, [103]],
  ]);
  assert.deepEqual(result.unlinkedCountermeasures, []);
});

test('groupCountermeasuresByFailureAnalysis keeps missing and unknown references separate', () => {
  const analysisIssues = [{ number: 12 }];
  const countermeasureIssues = [
    { number: 101, body: '### countermeasure\nRelated failure analysis: #12' },
    { number: 102, body: '### countermeasure\nRelated failure analysis: #99' },
    { number: 103, body: '### countermeasure' },
  ];

  const result = groupCountermeasuresByFailureAnalysis(analysisIssues, countermeasureIssues);

  assert.deepEqual(result.groups.map(({ analysisIssue, countermeasureIssues: linked }) => [
    analysisIssue.number,
    linked.map((issue) => issue.number),
  ]), [[12, [101]]]);
  assert.deepEqual(result.unlinkedCountermeasures.map((issue) => issue.number), [102, 103]);
});

test('groupCountermeasuresByFailureAnalysis links one countermeasure to every referenced analysis issue', () => {
  const analysisIssues = [{ number: 2 }, { number: 4 }, { number: 6 }, { number: 8 }];
  const countermeasureIssues = [
    { number: 101, body: 'Related failure analysis: #2, #4' },
    { number: 102, body: 'Related failure analysis: #2; #6' },
    { number: 103, body: 'Related failure analysis: #4 #8' },
    { number: 104, body: 'Related failure analysis: #2 - #8' },
    { number: 105, body: 'Related failure analysis: #2, #2, #4' },
  ];

  const result = groupCountermeasuresByFailureAnalysis(analysisIssues, countermeasureIssues);

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

test('buildIssueListUrl includes legacy Failure Analysis labels for existing issues', () => {
  const url = new URL(buildIssueListUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'failure_analysis',
  }));

  assert.equal(url.searchParams.get('q'), 'label:failure_analysis,analysis_result');
});

test('buildPullRequestCreateUrl opens the repository compare page', () => {
  assert.equal(buildPullRequestCreateUrl({ owner: 'octo-org', repo: 'demo-repo' }),
    'https://github.com/octo-org/demo-repo/compare');
});

test('pull request issue references are deduplicated and can be added without removing existing links', () => {
  assert.deepEqual(
    getPullRequestIssueNumbers('Closes #2\nRelated to octo-org/demo#4\nhttps://github.com/octo-org/demo/issues/2'),
    [2, 4]
  );
  assert.equal(
    addPullRequestIssueReferences('Closes #2', {
      failureAnalysisIssueNumbers: [2, 4, 4],
      countermeasureIssueNumbers: [10],
    }),
    'Closes #2\n\n<!-- Issue Map relationship guidance\n'
      + '"Related to failure analysis #<number>" links a Failure Analysis.\n'
      + '"Related to countermeasure #<number>" links a Countermeasure.\n'
      + 'Add one reference per line. This optional note can be removed.\n'
      + '-->\nRelated to failure analysis #2\nRelated to failure analysis #4\n'
      + 'Related to countermeasure #10'
  );
  assert.deepEqual(
    getPullRequestIssueNumbers(
      'Related to octo-org/demo#4\nRelated to another/repo#5\nRelated to https://github.com/octo-org/demo/issues/6',
      { owner: 'octo-org', repo: 'demo' }
    ),
    [4, 6]
  );
  assert.deepEqual(
    getPullRequestIssueNumbers([
      'Related to #8',
      '* Related to: #2, #4 and #6',
      'Fixes #10',
      'See #99 for details',
      'Related to another/repo#12',
    ].join('\n'), { owner: 'octo-org', repo: 'demo' }),
    [2, 4, 6, 8, 10]
  );
  assert.deepEqual(
    getPullRequestIssueNumbers([
      '<!--',
      'Related to #123',
      '-->',
      'Related to #2',
      'Related to #10',
    ].join('\n')),
    [2, 10]
  );
  const withGuidance = addPullRequestIssueReferences('', {
    failureAnalysisIssueNumbers: [2],
    countermeasureIssueNumbers: [10],
  });
  assert.match(withGuidance, /Failure Analysis/);
  assert.match(withGuidance, /Countermeasure/);
  assert.match(withGuidance, /This optional note can be removed/);
  assert.deepEqual(getPullRequestIssueNumbers(withGuidance), [2, 10]);
  assert.deepEqual(
    getPullRequestIssueNumbers(withGuidance.replace(/<!--[\s\S]*?-->\n?/, '')),
    [2, 10]
  );
  assert.deepEqual(
    getPullRequestIssueNumbers('Related to analysis result #2\nRelated to failure analysis #3'),
    [2, 3]
  );
  assert.doesNotMatch(
    addPullRequestIssueReferences('Related to analysis result #2', {
      failureAnalysisIssueNumbers: [2],
      countermeasureIssueNumbers: [],
    }),
    /Related to failure analysis #2/
  );
  assert.match(
    addPullRequestIssueReferences('Related to #2\nRelated to #10', {
      failureAnalysisIssueNumbers: [2],
      countermeasureIssueNumbers: [10],
    }),
    /<!-- Issue Map relationship guidance/
  );
  assert.equal(
    addPullRequestIssueReferences(withGuidance, {
      failureAnalysisIssueNumbers: [2],
      countermeasureIssueNumbers: [10],
    }),
    withGuidance
  );
  assert.equal(
    addPullRequestIssueReferences('Related to other/repo#2', {
      failureAnalysisIssueNumbers: [2],
      countermeasureIssueNumbers: [],
    }, {
      owner: 'octo-org',
      repo: 'demo',
    }),
    'Related to other/repo#2\n\n<!-- Issue Map relationship guidance\n'
      + '"Related to failure analysis #<number>" links a Failure Analysis.\n'
      + '"Related to countermeasure #<number>" links a Countermeasure.\n'
      + 'Add one reference per line. This optional note can be removed.\n'
      + '-->\nRelated to failure analysis #2'
  );
  assert.equal(
    addPullRequestIssueReferences('Related to #2\nRelated to #10', {
      failureAnalysisIssueNumbers: [2],
      countermeasureIssueNumbers: [10],
    }),
    'Related to #2\nRelated to #10\n\n<!-- Issue Map relationship guidance\n'
      + '"Related to failure analysis #<number>" links a Failure Analysis.\n'
      + '"Related to countermeasure #<number>" links a Countermeasure.\n'
      + 'Add one reference per line. This optional note can be removed.\n'
      + '-->\nRelated to failure analysis #2\nRelated to countermeasure #10'
  );
  assert.throws(
    () => addPullRequestIssueReferences('', {
      failureAnalysisIssueNumbers: [0],
      countermeasureIssueNumbers: [],
    }),
    /references are invalid/
  );
});

test('buildIssueMapRows expands PR links into one row per analysis-countermeasure-PR combination', () => {
  const analysisIssues = [{ number: 2 }, { number: 4 }, { number: 6 }];
  const countermeasureIssues = [
    { number: 10, body: 'Related failure analysis: #2' },
    { number: 11, body: '' },
    { number: 12, body: '' },
  ];
  const pullRequests = [
    { number: 201, body: 'Closes #2\nCloses #4\nRelated to #10\nRelated to #11' },
    { number: 202, body: 'Closes #4\nRelated to #11' },
  ];
  const rows = buildIssueMapRows(analysisIssues, countermeasureIssues, pullRequests, {
    owner: 'octo-org',
    repo: 'demo-repo',
  });

  assert.deepEqual(rows.map(({ analysisIssue, countermeasureIssue, pullRequest }) => [
    analysisIssue?.number ?? null,
    countermeasureIssue?.number ?? null,
    pullRequest?.number ?? null,
  ]), [
    [2, 10, 201],
    [2, 11, 201],
    [4, 10, 201],
    [4, 11, 201],
    [4, 11, 202],
    [6, null, null],
    [null, 12, null],
  ]);
});
