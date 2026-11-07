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

function parseBulletList(markdown, heading) {
  const lines = (markdown || '').split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => (
    new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'i').test(line.trim())
  ));
  if (headingIndex < 0) {
    return [];
  }

  const section = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^#{1,6}\s/.test(line.trim())) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith('* ')) {
      section.push(trimmed.replace(/^\*\s*/, ''));
    }
  }
  return section.filter(Boolean);
}

function extractFieldValue(list, fieldLabel) {
  const matched = list.find((line) => line.startsWith(`${fieldLabel}:`));
  if (!matched) {
    return '';
  }
  return normalizeText(matched.slice(fieldLabel.length + 1));
}

function extractNumberValue(list, fieldLabel) {
  const value = extractFieldValue(list, fieldLabel);
  if (!value) {
    return '';
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function parseAnalysisResult(markdown) {
  const list = parseBulletList(markdown, 'analysis result');

  return {
    failureMode: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureMode),
    failureCause: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureCause),
    failureCategory: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.failureCategory),
    prevention: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.prevention),
    detectionMethod: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.detectionMethod),
    effect: extractFieldValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.effect),
    severity: extractNumberValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.severity),
    occurrence: extractNumberValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.occurrence),
    detection: extractNumberValue(list, ISSUE_FIELDS.ANALYSIS_RESULT.detection),
  };
}

function parseCountermeasure(markdown) {
  const list = parseBulletList(markdown, 'countermeasure');

  return {
    content: extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.content),
    effectImpact: extractFieldValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectImpact),
    effectOccurrence: extractNumberValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectOccurrence),
    effectDetection: extractNumberValue(list, ISSUE_FIELDS.COUNTERMEASURE.effectDetection),
    rpn: extractNumberValue(list, ISSUE_FIELDS.COUNTERMEASURE.rpn),
    owner: extractFieldValue(list, 'Owner'),
    deadline: extractFieldValue(list, 'Deadline'),
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
