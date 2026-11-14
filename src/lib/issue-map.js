const ISSUE_FIELDS = {
  ANALYSIS_RESULT: {
    failureMode: 'Failure Mode',
    failureCause: 'Failure Cause',
    failureCategory: 'Failure Classification',
    prevention: 'Preventive Measure',
    detectionMethod: 'Detection Method',
    effect: 'Effect',
    severity: 'Severity',
    occurrence: 'Occurrence',
    detection: 'Detection',
  },
  COUNTERMEASURE: {
    content: 'Content',
    effectImpact: 'Effect(Effect)',
    effectOccurrence: 'Effect(Occurrence)',
    effectDetection: 'Effect(Detection)',
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
* RPN: <!-- insert countermeasure RPN -->`,
};

const PULL_REQUEST_RELATIONSHIP_GUIDANCE = `<!-- Issue Map relationship guidance
"Related to analysis result #<number>" links an Analysis Result.
"Related to countermeasure #<number>" links a Countermeasure.
Add one reference per line. This optional note can be removed.
-->`;

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
  return updateAnalysisIssueReferences(body, [issueNumber]);
}

function getAnalysisIssueNumbers(body) {
  const references = [...String(body || '').matchAll(
    /^[ \t]*(?:[-*+][ \t]*)?(?:related[ \t]+)?analysis[ \t_-]*result(?:[ \t]+issue)?(?:[ \t]+number)?[ \t]*:[ \t]*([^\r\n]*)$/gim
  )];
  return [...new Set(
    references.flatMap((reference) => [...reference[1].matchAll(/#?(\d+)/g)]
      .map((numberMatch) => Number(numberMatch[1])))
  )];
}

function updateAnalysisIssueReferences(body, issueNumbers) {
  if (!Array.isArray(issueNumbers)
    || issueNumbers.some((number) => !Number.isInteger(number) || number < 1)) {
    throw new Error('The analysis result issue number is invalid');
  }
  const lines = String(body || '').split(/\r?\n/);
  const existingReferences = getAnalysisIssueNumbers(body);
  const referenceLine = /^[ \t]*(?:[-*+][ \t]*)?(?:related[ \t]+)?analysis[ \t_-]*result(?:[ \t]+issue)?(?:[ \t]+number)?[ \t]*:[ \t]*[^\r\n]*$/i;
  const content = lines.filter((line) => !referenceLine.test(line)).join('\n').trimEnd();
  const allIssueNumbers = [...new Set([...existingReferences, ...issueNumbers])].sort((a, b) => a - b);
  if (allIssueNumbers.length === 0) {
    return content;
  }
  const reference = `Related analysis result: ${allIssueNumbers.map((number) => `#${number}`).join(', ')}`;
  return `${content}${content ? '\n\n' : ''}${reference}`;
}

function groupCountermeasuresByAnalysis(analysisIssues, countermeasureIssues) {
  const analysisByNumber = new Map(analysisIssues.map((issue) => [issue.number, issue]));
  const countermeasuresByNumber = new Map(
    analysisIssues.map((issue) => [issue.number, []])
  );
  const unlinkedCountermeasures = [];

  for (const issue of countermeasureIssues) {
    const associatedAnalysisNumbers = getAnalysisIssueNumbers(issue.body)
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

function buildPullRequestCreateUrl({ owner, repo }) {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare`;
}

function getPullRequestIssueNumbers(body, repoContext = null) {
  return [...new Set(getPullRequestIssueReferences(body, repoContext)
    .map((reference) => reference.number))]
    .sort((left, right) => left - right);
}

function getPullRequestIssueReferences(body, repoContext = null) {
  const numbers = [];
  const currentOwner = repoContext?.owner?.toLowerCase();
  const currentRepo = repoContext?.repo?.toLowerCase();
  const referencePattern = /(?:(?<qualifiedOwner>[\w.-]+)\/(?<qualifiedRepo>[\w.-]+))?#(?<shortNumber>\d+)|https?:\/\/github\.com\/(?<urlOwner>[\w.-]+)\/(?<urlRepo>[\w.-]+)\/issues\/(?<urlNumber>\d+)/g;
  const relationshipPattern = /^[ \t]*(?:[-*+][ \t]*)?(?:[*_`]*related[*_`]*[ \t]+[*_`]*to[*_`]*(?:[ \t]+(?<issueType>analysis[ \t_-]*result|countermeasure))?|close[sd]?|fix(?:es|ed)?|resolve[sd]?)\b[ \t]*:?[ \t]*(.+)$/gim;
  const description = String(body || '').replace(/<!--[\s\S]*?-->/g, '');
  for (const relationship of description.matchAll(relationshipPattern)) {
    const issueType = relationship.groups.issueType?.toLowerCase().replace(/[ \t_-]+/g, ' ');
    for (const match of relationship[2].matchAll(referencePattern)) {
      const owner = match.groups.qualifiedOwner || match.groups.urlOwner;
      const repo = match.groups.qualifiedRepo || match.groups.urlRepo;
      if (owner && repo && currentOwner && currentRepo
        && (owner.toLowerCase() !== currentOwner || repo.toLowerCase() !== currentRepo)) {
        continue;
      }
      numbers.push({
        number: Number(match.groups.shortNumber || match.groups.urlNumber),
        issueType,
      });
    }
  }
  return numbers;
}

function addPullRequestIssueReferences(body, issueNumbersByType, repoContext = null) {
  const { analysisIssueNumbers, countermeasureIssueNumbers } = issueNumbersByType || {};
  const validNumbers = (numbers) => Array.isArray(numbers)
    && numbers.every((number) => Number.isInteger(number) && number > 0);
  if (!validNumbers(analysisIssueNumbers) || !validNumbers(countermeasureIssueNumbers)) {
    throw new Error('The pull request issue references are invalid');
  }
  const existingReferences = getPullRequestIssueReferences(body, repoContext);
  const hasTypedReference = (number, issueType) => existingReferences.some(
    (reference) => reference.number === number && reference.issueType === issueType
  );
  const newAnalysisReferences = [...new Set(analysisIssueNumbers)]
    .filter((number) => !hasTypedReference(number, 'analysis result'));
  const newCountermeasureReferences = [...new Set(countermeasureIssueNumbers)]
    .filter((number) => !hasTypedReference(number, 'countermeasure'));
  const content = String(body || '').trimEnd();
  const guidance = content.includes('<!-- Issue Map relationship guidance')
    ? ''
    : `${PULL_REQUEST_RELATIONSHIP_GUIDANCE}\n`;
  if (newAnalysisReferences.length === 0 && newCountermeasureReferences.length === 0 && !guidance) {
    return content;
  }
  const referenceLines = [
    ...newAnalysisReferences.map((number) => `Related to analysis result #${number}`),
    ...newCountermeasureReferences.map((number) => `Related to countermeasure #${number}`),
  ].join('\n');
  const additions = `${guidance}${referenceLines}`;
  return `${content}${content ? '\n\n' : ''}${additions}`;
}

function buildIssueMapRows(analysisIssues, countermeasureIssues, pullRequests, repoContext = null) {
  const analysisByNumber = new Map(analysisIssues.map((issue) => [issue.number, issue]));
  const countermeasureByNumber = new Map(countermeasureIssues.map((issue) => [issue.number, issue]));
  const analysisToCountermeasures = new Map(analysisIssues.map((issue) => [issue.number, new Set()]));
  const countermeasureToAnalyses = new Map(countermeasureIssues.map((issue) => [issue.number, new Set()]));

  const addPair = (analysisNumber, countermeasureNumber) => {
    if (!analysisByNumber.has(analysisNumber) || !countermeasureByNumber.has(countermeasureNumber)) {
      return;
    }
    analysisToCountermeasures.get(analysisNumber).add(countermeasureNumber);
    countermeasureToAnalyses.get(countermeasureNumber).add(analysisNumber);
  };

  for (const countermeasure of countermeasureIssues) {
    for (const analysisNumber of getAnalysisIssueNumbers(countermeasure.body)) {
      addPair(analysisNumber, countermeasure.number);
    }
  }

  const pullRequestReferences = new Map();
  for (const pullRequest of pullRequests) {
    const references = new Set(getPullRequestIssueNumbers(pullRequest.body, repoContext));
    const analysisNumbers = [...references].filter((number) => analysisByNumber.has(number));
    const countermeasureNumbers = [...references].filter((number) => countermeasureByNumber.has(number));
    pullRequestReferences.set(pullRequest.number, references);
    for (const analysisNumber of analysisNumbers) {
      for (const countermeasureNumber of countermeasureNumbers) {
        addPair(analysisNumber, countermeasureNumber);
      }
    }
  }

  const rows = [];
  for (const analysisIssue of analysisIssues) {
    const countermeasureNumbers = analysisToCountermeasures.get(analysisIssue.number);
    if (countermeasureNumbers.size === 0) {
      rows.push({ analysisIssue, countermeasureIssue: null, pullRequest: null });
      continue;
    }
    for (const countermeasureNumber of countermeasureNumbers) {
      const countermeasureIssue = countermeasureByNumber.get(countermeasureNumber);
      const linkedPullRequests = pullRequests.filter((pullRequest) => (
        pullRequestReferences.get(pullRequest.number)?.has(analysisIssue.number)
        && pullRequestReferences.get(pullRequest.number)?.has(countermeasureNumber)
      ));
      if (linkedPullRequests.length === 0) {
        rows.push({ analysisIssue, countermeasureIssue, pullRequest: null });
      } else {
        for (const pullRequest of linkedPullRequests) {
          rows.push({ analysisIssue, countermeasureIssue, pullRequest });
        }
      }
    }
  }

  for (const countermeasureIssue of countermeasureIssues) {
    if (countermeasureToAnalyses.get(countermeasureIssue.number).size === 0) {
      rows.push({ analysisIssue: null, countermeasureIssue, pullRequest: null });
    }
  }
  return rows;
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
  getAnalysisIssueNumbers,
  updateAnalysisIssueReferences,
  groupCountermeasuresByAnalysis,
  buildIssueListUrl,
  buildPullRequestCreateUrl,
  getPullRequestIssueNumbers,
  addPullRequestIssueReferences,
  buildIssueMapRows,
  getRepoContextFromPath,
};
