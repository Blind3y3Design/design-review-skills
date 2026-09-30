import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node tests/smoke/compare.mjs <case id or expected JSON file> <report file, or - to read it from stdin>';

function main([caseArg, reportArg]) {
  if (!caseArg || !reportArg) return fail(USAGE);
  const expectedPath = existsSync(caseArg) ? caseArg : fileURLToPath(new URL(`./expected/${caseArg}.json`, import.meta.url));
  if (!existsSync(expectedPath)) return fail(`No expected JSON for case ${caseArg} (looked for ${expectedPath})`);
  let expected, actual;
  try {
    expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    actual = readReport(readFileSync(reportArg === '-' ? 0 : reportArg, 'utf8'));
  } catch (error) {
    return fail(error.message);
  }
  const name = expected.case || caseArg;
  const { pass, differences } = compareReports(expected, actual);
  process.stdout.write(pass ? `PASS ${name}\n` : `FAIL ${name}\n${differences.map((d) => `- ${d}\n`).join('')}`);
  process.exitCode = pass ? 0 : 1;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}

export function readReport(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const blocks = [...text.matchAll(/^```json[^\n]*\n([\s\S]*?)^```/gm)];
  if (!blocks.length) throw new Error('There is no report JSON: paste the whole report, or its JSON block');
  return JSON.parse(blocks[blocks.length - 1][1]);
}

const related = (finding) => [...(finding.relatedFindings || [])].sort();

export function compareReports(expected, actual) {
  const differences = [];
  for (const list of ['findings', 'coverage']) {
    if (!Array.isArray(actual[list])) differences.push(`The report has no "${list}" array`);
  }
  if (differences.length) return { pass: false, differences };
  const actualById = new Map();
  for (const f of actual.findings) {
    if (actualById.has(f.id)) differences.push(`Duplicate Finding id ${f.id}`);
    actualById.set(f.id, f);
  }
  const expectedIds = new Set(expected.findings.map((f) => f.id));
  for (const want of expected.findings) {
    const got = actualById.get(want.id);
    if (!got) {
      differences.push(`Missing Finding ${want.id}`);
      continue;
    }
    for (const field of ['axis', 'severity', 'certainty']) {
      if (got[field] !== want[field]) {
        differences.push(`Finding ${want.id}: ${field} is "${got[field]}", expected "${want[field]}"`);
      }
    }
    const [gotRelated, wantRelated] = [related(got), related(want)];
    if (gotRelated.join('\n') !== wantRelated.join('\n')) {
      differences.push(`Finding ${want.id}: relatedFindings are [${gotRelated.join(', ')}], expected [${wantRelated.join(', ')}]`);
    }
  }
  for (const got of actual.findings) {
    if (!expectedIds.has(got.id)) {
      differences.push(`Unexpected Finding ${got.id} (${got.axis}, ${got.severity}, ${got.certainty})`);
    }
  }

  const actualCoverage = new Map(actual.coverage.map((c) => [coverageKey(c), c]));
  const expectedCoverage = new Set(expected.coverage.map(coverageKey));
  for (const want of expected.coverage) {
    const key = coverageKey(want);
    const got = actualCoverage.get(key);
    if (!got) differences.push(`Missing Coverage ${key}`);
    else if (got.status !== want.status) {
      differences.push(`Coverage ${key}: status is "${got.status}", expected "${want.status}"`);
    }
  }
  for (const got of actual.coverage) {
    const key = coverageKey(got);
    if (!expectedCoverage.has(key)) differences.push(`Unexpected Coverage ${key} (${got.status})`);
  }
  return { pass: differences.length === 0, differences };
}

const coverageKey = (entry) => (entry.ref === undefined ? `${entry.axis} (whole axis)` : `${entry.axis} ${entry.ref}`);

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
