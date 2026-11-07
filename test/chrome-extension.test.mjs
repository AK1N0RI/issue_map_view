import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAnalysisResult,
  parseCountermeasure,
  buildIssueCreateUrl,
  buildIssueListUrl,
  deriveCountermeasureStatus,
} from '../src/lib/issue-map.js';

test('parseAnalysisResult extracts structured fields from markdown', () => {
  const markdown = `
### analysis result
* 故障モード: 〇〇が動作しない
* 故障原因: 〇〇の部品が破損している
* 故障分類: 機械的故障
* 防止策: 〇〇の部品を定期的に交換する
* 検出方法: 〇〇の部品の状態を定期的
* 影響: 〇〇が動作しないと、〇〇が停止する
* 重大度: 9
* 発生度: 7
* 検出度: 3
`;

  const result = parseAnalysisResult(markdown);

  assert.equal(result.failureMode, '〇〇が動作しない');
  assert.equal(result.failureCause, '〇〇の部品が破損している');
  assert.equal(result.failureCategory, '機械的故障');
  assert.equal(result.prevention, '〇〇の部品を定期的に交換する');
  assert.equal(result.detectionMethod, '〇〇の部品の状態を定期的');
  assert.equal(result.effect, '〇〇が動作しないと、〇〇が停止する');
  assert.equal(result.severity, 9);
  assert.equal(result.occurrence, 7);
  assert.equal(result.detection, 3);
});

test('parseAnalysisResult ignores bullets outside its section and leaves missing scores blank', () => {
  const result = parseAnalysisResult(`
* 故障モード: unrelated section
### analysis result
* 故障モード: issue title details
* 故障原因: worn bearing
### notes
* 重大度: 9
`);

  assert.equal(result.failureMode, 'issue title details');
  assert.equal(result.failureCause, 'worn bearing');
  assert.equal(result.severity, '');
});

test('parseCountermeasure extracts measure data from markdown', () => {
  const markdown = `
### countermeasure
* 対策内容: 〇〇の部品を定期的に交換する
* 対策効果(影響): 〇〇が動作しないと、〇〇が停止する
* 対策効果(発生): 7
* 対策効果(検出): 3
* RPN: 189
* Owner: A. Example
* Deadline: 2026-12-31
`;

  const result = parseCountermeasure(markdown);

  assert.equal(result.content, '〇〇の部品を定期的に交換する');
  assert.equal(result.effectImpact, '〇〇が動作しないと、〇〇が停止する');
  assert.equal(result.effectOccurrence, 7);
  assert.equal(result.effectDetection, 3);
  assert.equal(result.rpn, 189);
  assert.equal(result.owner, 'A. Example');
  assert.equal(result.deadline, '2026-12-31');
});

test('buildIssueCreateUrl adds the analysis_result label for issue creation', () => {
  const url = buildIssueCreateUrl({
    owner: 'octo-org',
    repo: 'demo-repo',
    type: 'analysis_result',
  });

  assert.equal(
    url,
    'https://github.com/octo-org/demo-repo/issues/new?labels=analysis_result'
  );
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
  assert.equal(deriveCountermeasureStatus({ merged: true }), '完了');
  assert.equal(deriveCountermeasureStatus({ merged: false, hasPullRequest: true }), '未完了');
  assert.equal(deriveCountermeasureStatus({ merged: false, hasPullRequest: false }), '未着手');
});
