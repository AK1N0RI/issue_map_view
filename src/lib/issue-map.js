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

const ISSUE_CREATE_BODIES = {
  analysis_result: `### analysis result
<!-- do not edit predefined fields -->
* Failure Mode: <!-- insert failure mode -->
* Failure Cause: <!-- insert failure cause -->
* Failure Classification: <!-- insert failure classification -->
* Preventive Measure: <!-- insert preventive measure -->
* Detection Method: <!-- insert detection method -->
* Effect: <!-- insert effect -->
* Severity: <!-- insert severity -->
* Occurrence: <!-- insert occurrence -->
* Detection: <!-- insert detection -->`,
  countermeasure: `### countermeasure
<!-- do not edit predefined fields -->
* Content: <!-- insert countermeasure content -->
* Effect(Effect): <!-- insert countermeasure effect on effect -->
* Effect(Occurrence): <!-- insert countermeasure effect on occurrence -->
* Effect(Detection): <!-- insert countermeasure effect on detection -->
* RPN: <!-- insert countermeasure RPN -->
* Status: <!-- insert countermeasure status -->
* Owner: <!-- insert countermeasure owner -->
* Deadline: <!-- insert countermeasure deadline -->`,
};

function normalizeText(value) {
  return String(value ?? '').replace(/<!--.*?-->/g, '').trim();
}

function parseBulletList(markdown, heading) {
  const lines = (markdown || '').split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => (
    new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'i').test(line.trim())
  ));
  const section = [];
  for (const line of lines.slice(headingIndex < 0 ? 0 : headingIndex + 1)) {
    if (/^#{1,6}\s/.test(line.trim())) {
      if (headingIndex >= 0) {
        break;
      }
      continue;
    }
    const rawLine = line.trim();
    const trimmed = rawLine.replace(/^[-*+]\s+/, '');
    if (/^[-*+]\s+/.test(rawLine) || rawLine.startsWith('|')) {
      const tableCells = trimmed.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (tableCells.length > 1 && tableCells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }
      section.push(tableCells.length > 1 ? `${tableCells[0]}: ${tableCells[1]}` : trimmed);
      continue;
    }

    if (headingIndex < 0 && /^[^:]{1,80}:\s*/.test(trimmed)) {
      section.push(trimmed);
    }
  }
  return section.filter(Boolean);
}

function extractFieldValue(list, fieldLabel) {
  const labels = Array.isArray(fieldLabel) ? fieldLabel : [fieldLabel];
  for (const line of list) {
    for (const label of labels) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = line.match(new RegExp(`^\\**\\s*${escapedLabel}\\s*\\**\\s*:\\s*(.*)$`, 'i'));
      if (match) {
        return normalizeText(match[1]);
      }
    }
  }
  return '';
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
    failureMode: extractFieldValue(list, ['Failure Mode', ISSUE_FIELDS.ANALYSIS_RESULT.failureMode]),
    failureCause: extractFieldValue(list, ['Failure Cause', ISSUE_FIELDS.ANALYSIS_RESULT.failureCause]),
    failureCategory: extractFieldValue(list, ['Failure Classification', ISSUE_FIELDS.ANALYSIS_RESULT.failureCategory]),
    prevention: extractFieldValue(list, ['Preventive Measure', ISSUE_FIELDS.ANALYSIS_RESULT.prevention]),
    detectionMethod: extractFieldValue(list, ['Detection Method', ISSUE_FIELDS.ANALYSIS_RESULT.detectionMethod]),
    effect: extractFieldValue(list, ['Effect', ISSUE_FIELDS.ANALYSIS_RESULT.effect]),
    severity: extractNumberValue(list, ['Severity', ISSUE_FIELDS.ANALYSIS_RESULT.severity]),
    occurrence: extractNumberValue(list, ['Occurrence', ISSUE_FIELDS.ANALYSIS_RESULT.occurrence]),
    detection: extractNumberValue(list, ['Detection', ISSUE_FIELDS.ANALYSIS_RESULT.detection]),
  };
}

function parseCountermeasure(markdown) {
  const list = parseBulletList(markdown, 'countermeasure');

  return {
    content: extractFieldValue(list, ['Content', ISSUE_FIELDS.COUNTERMEASURE.content]),
    effectImpact: extractFieldValue(list, ['Effect(Effect)', ISSUE_FIELDS.COUNTERMEASURE.effectImpact]),
    effectOccurrence: extractNumberValue(list, ['Effect(Occurrence)', ISSUE_FIELDS.COUNTERMEASURE.effectOccurrence]),
    effectDetection: extractNumberValue(list, ['Effect(Detection)', ISSUE_FIELDS.COUNTERMEASURE.effectDetection]),
    rpn: extractNumberValue(list, ISSUE_FIELDS.COUNTERMEASURE.rpn),
    owner: extractFieldValue(list, 'Owner'),
    deadline: extractFieldValue(list, 'Deadline'),
  };
}

function buildIssueCreateUrl({ owner, repo, type, title, body }) {
  const label = type === 'countermeasure' ? 'countermeasure' : 'analysis_result';
  const url = new URL(`https://github.com/${owner}/${repo}/issues/new`);
  url.searchParams.set('labels', label);
  url.searchParams.set('body', body ?? ISSUE_CREATE_BODIES[label]);
  if (title !== undefined) {
    url.searchParams.set('title', title);
  }
  return url.toString();
}

function buildIssueCreateApiRequest({ owner, repo, type, title, body }) {
  const label = type === 'countermeasure' ? 'countermeasure' : 'analysis_result';
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`
  );
  return {
    url: url.toString(),
    method: 'POST',
    payload: {
      title: title.trim(),
      body,
      labels: [label],
    },
  };
}

function addAnalysisIssueReference(body, issueNumber) {
  if (issueNumber == null) {
    return body;
  }
  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    throw new Error('Analysis Result Issue番号が不正です');
  }
  return `${body.trimEnd()}\n\nRelated analysis result: #${issueNumber}`;
}

function groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues) {
  const analysisByNumber = new Map(analysisIssues.map((issue) => [issue.number, issue]));
  const countermeasuresByNumber = new Map(
    analysisIssues.map((issue) => [issue.number, []])
  );
  const unlinkedCountermeasures = [];

  for (const issue of countermeasureIssues) {
    const references = [...(issue.body || '').matchAll(
      /^[ \t]*(?:[-*+][ \t]*)?(?:related[ \t]+)?analysis[ \t_-]*result(?:[ \t]+issue)?(?:[ \t]+number)?[ \t]*:[ \t]*([^\r\n]*)$/gim
    )];
    const analysisNumbers = new Set(
      references.flatMap((reference) => [...reference[1].matchAll(/#?(\d+)/g)]
        .map((numberMatch) => Number(numberMatch[1])))
    );
    const associatedAnalysisNumbers = [...analysisNumbers]
      .filter((number) => analysisByNumber.has(number));
    if (associatedAnalysisNumbers.length === 0) {
      unlinkedCountermeasures.push(issue);
      continue;
    }
    for (const analysisNumber of associatedAnalysisNumbers) {
      countermeasuresByNumber.get(analysisNumber).push(issue);
    }
  }

  return {
    groups: analysisIssues.map((analysisIssue) => ({
      analysisIssue,
      countermeasureIssues: countermeasuresByNumber.get(analysisIssue.number),
    })),
    unlinkedCountermeasures,
  };
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
  buildIssueCreateApiRequest,
  addAnalysisIssueReference,
  groupCountermeasuresByAnalysis,
  buildIssueListUrl,
  deriveCountermeasureStatus,
  getRepoContextFromPath,
};
