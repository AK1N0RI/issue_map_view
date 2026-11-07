const ISSUE_FIELDS = {
  ANALYSIS_RESULT: {
    failureMode: '故障モード',
    failureCause: '故障原因',
    failureCategory: '故障分類',
    prevention: '防止策',
    detectionMethod: '検出方法',
    effect: '影響',
    severity: '重大度',
    occurrence: '発生度',
    detection: '検出度',
  },
  COUNTERMEASURE: {
    content: '対策内容',
    effectImpact: '対策効果(影響)',
    effectOccurrence: '対策効果(発生)',
    effectDetection: '対策効果(検出)',
    rpn: 'RPN',
  },
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function parseBulletList(markdown) {
  return (markdown || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('* '))
    .map((line) => line.replace(/^\*\s*/, ''))
    .filter(Boolean);
}

function extractFieldValue(list, fieldLabel) {
  const matched = list.find((line) => line.startsWith(`${fieldLabel}:`));
  if (!matched) {
    return '';
  }
  return normalizeText(matched.slice(fieldLabel.length + 1));
}

function parseAnalysisResult(markdown) {
  const list = parseBulletList(markdown);

  return {
    failureMode: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureMode),
    failureCause: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureCause),
    failureCategory: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureCategory),
    prevention: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.prevention),
    detectionMethod: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.detectionMethod),
    effect: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.effect),
    severity: Number(extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.severity) || 0),
    occurrence: Number(extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.occurrence) || 0),
    detection: Number(extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.detection) || 0),
  };
}

function parseCountermeasure(markdown) {
  const list = parseBulletList(markdown);

  return {
    content: extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.content),
    effectImpact: extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectImpact),
    effectOccurrence: Number(extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectOccurrence) || 0),
    effectDetection: Number(extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectDetection) || 0),
    rpn: Number(extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.rpn) || 0),
  };
}

function buildIssueCreateUrl({ owner, repo, type }) {
  const label = type === 'countermeasure' ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues/new`);
  url.searchParams.set('labels', label);
  return url.toString();
}

function buildIssueListUrl({ owner, repo, type }) {
  const label = type === 'countermeasure' ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues`);
  url.searchParams.set('q', `label:"${label}"`);
  return url.toString();
}

function deriveCountermeasureStatus({ merged, hasPullRequest }) {
  if (merged === true) {
    return '完了';
  }
  if (hasPullRequest === true) {
    return '未完了';
  }
  return '未着手';
}

function getRepoContextFromPath(pathname) {
  const parts = (pathname || '/').split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const [owner, repo] = parts;
  return { owner, repo };
}

export {
  ISSUE_FIELDS,
  parseAnalysisResult,
  parseCountermeasure,
  buildIssueCreateUrl,
  buildIssueListUrl,
  deriveCountermeasureStatus,
  getRepoContextFromPath,
};
