import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareReports, readReport } from './compare.mjs';

const script = fileURLToPath(new URL('./compare.mjs', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });
const saved = (name, text) => {
  const path = join(mkdtempSync(join(tmpdir(), 'compare-')), name);
  writeFileSync(path, text);
  return path;
};
// A case's expected JSON, which is also a report that matches it.
const load = (id) => JSON.parse(readFileSync(new URL(`./expected/${id}.json`, import.meta.url), 'utf8'));
// A small report, for the tests of how the comparison works.
const report = () => ({
  schemaVersion: '0.2',
  findings: [
    {
      id: 'accessibility/1.4.3/node:5:5',
      axis: 'accessibility',
      title: 'Body text contrast is 3.45:1, below 4.5:1',
      severity: 'moderate',
      certainty: 'confirmed',
      evidence: '#8A8A8A on #FFFFFF = 3.45:1, needs 4.5:1',
    },
  ],
  coverage: [{ axis: 'accessibility', ref: '1.4.3', status: 'judged' }],
});

test('a report that matches its expected JSON passes', () => {
  const result = compareReports(report(), report());
  assert.equal(result.pass, true);
  assert.deepEqual(result.differences, []);
});

test('a Finding at a different Severity fails, naming the Finding and both values', () => {
  const actual = report();
  actual.findings[0].severity = 'serious';
  const result = compareReports(report(), actual);
  assert.equal(result.pass, false);
  assert.deepEqual(result.differences, [
    'Finding accessibility/1.4.3/node:5:5: severity is "serious", expected "moderate"',
  ]);
});

test('a Finding with a different fingerprint id fails as one missing and one unexpected Finding', () => {
  const actual = report();
  actual.findings[0].id = 'accessibility/1.4.3/node:5:4';
  const result = compareReports(report(), actual);
  assert.equal(result.pass, false);
  assert.deepEqual(result.differences, [
    'Missing Finding accessibility/1.4.3/node:5:5',
    'Unexpected Finding accessibility/1.4.3/node:5:4 (accessibility, moderate, confirmed)',
  ]);
});

test('a Finding with a different axis or Certainty fails', () => {
  const actual = report();
  actual.findings[0].axis = 'design-system';
  actual.findings[0].certainty = 'likely';
  const result = compareReports(report(), actual);
  assert.deepEqual(result.differences, [
    'Finding accessibility/1.4.3/node:5:5: axis is "design-system", expected "accessibility"',
    'Finding accessibility/1.4.3/node:5:5: certainty is "likely", expected "confirmed"',
  ]);
});

test('relatedFindings are compared as a set, and a missing list counts as empty', () => {
  const expected = report();
  expected.findings[0].relatedFindings = ['design-system/DS-RAW/node:5:5', 'research/INS-1/node:5:5'];
  const reordered = report();
  reordered.findings[0].relatedFindings = ['research/INS-1/node:5:5', 'design-system/DS-RAW/node:5:5'];
  assert.equal(compareReports(expected, reordered).pass, true);
  assert.equal(compareReports(report(), { ...report(), findings: [{ ...report().findings[0], relatedFindings: [] }] }).pass, true);

  const unlinked = report();
  assert.deepEqual(compareReports(expected, unlinked).differences, [
    'Finding accessibility/1.4.3/node:5:5: relatedFindings are [], expected [design-system/DS-RAW/node:5:5, research/INS-1/node:5:5]',
  ]);
});

test('a Coverage entry with a different status fails', () => {
  const actual = report();
  actual.coverage[0].status = 'not-readable';
  assert.deepEqual(compareReports(report(), actual).differences, [
    'Coverage accessibility 1.4.3: status is "not-readable", expected "judged"',
  ]);
});

test('a missing Coverage entry fails, and one the expected JSON does not list is left out', () => {
  const actual = report();
  actual.coverage = [{ axis: 'accessibility', ref: '1.4.11', status: 'judged' }];
  assert.deepEqual(compareReports(report(), actual).differences, ['Missing Coverage accessibility 1.4.3']);
});

test('with fullCoverage, a Coverage entry the expected JSON does not list fails', () => {
  const expected = { ...report(), fullCoverage: true };
  const actual = report();
  actual.coverage.push({ axis: 'accessibility', ref: '1.4.11', status: 'judged' });
  assert.deepEqual(compareReports(expected, actual).differences, ['Unexpected Coverage accessibility 1.4.11 (judged)']);
});

test('prose and other fields are never compared', () => {
  const actual = report();
  Object.assign(actual.findings[0], { title: 'Other words', evidence: 'Other evidence', fix: 'Other fix', locations: [] });
  actual.coverage[0].note = 'Other note';
  actual.run = { date: '2027-01-01' };
  assert.equal(compareReports(report(), actual).pass, true);
});

test('a report with no findings or coverage array fails without throwing', () => {
  const result = compareReports(report(), { schemaVersion: '0.2' });
  assert.equal(result.pass, false);
  assert.deepEqual(result.differences, ['The report has no "findings" array', 'The report has no "coverage" array']);
});

test('two Findings with the same id fail', () => {
  const actual = report();
  actual.findings.push({ ...actual.findings[0] });
  assert.deepEqual(compareReports(report(), actual).differences, ['Duplicate Finding accessibility/1.4.3/node:5:5']);
});

test('two Coverage entries for the same standard fail, even when one matches', () => {
  const actual = report();
  actual.coverage.unshift({ axis: 'accessibility', ref: '1.4.3', status: 'not-applicable' });
  assert.deepEqual(compareReports(report(), actual).differences, ['Duplicate Coverage accessibility 1.4.3']);
});

test('a Coverage entry with a null ref counts as a whole-axis entry', () => {
  const skipped = { findings: [], coverage: [{ axis: 'research', status: 'skipped' }] };
  const withNull = { findings: [], coverage: [{ axis: 'research', ref: null, status: 'skipped' }] };
  assert.equal(compareReports(skipped, withNull).pass, true);
});

test('a pasted report is read from raw JSON, or from the last json block of a Markdown report', () => {
  assert.deepEqual(readReport('{"findings": [], "coverage": []}'), { findings: [], coverage: [] });
  const markdown = [
    '# Design review: accessibility',
    '',
    'Evidence quoted inline: `{"not": "this"}`',
    '',
    '```json',
    '{"schemaVersion": "0.1"}',
    '```',
    '',
    '```json',
    '{"schemaVersion": "0.2", "findings": [], "coverage": []}',
    '```',
    '',
  ].join('\n');
  assert.deepEqual(readReport(markdown), { schemaVersion: '0.2', findings: [], coverage: [] });
});

test('text with no report JSON is refused with a reason', () => {
  assert.throws(() => readReport('The review could not run.'), /no report JSON/);
});

test('an axis-level skipped entry is matched by its axis', () => {
  const skipped = () => ({ findings: [], coverage: [{ axis: 'research', status: 'skipped', reason: 'no topic given' }] });
  assert.equal(compareReports(skipped(), skipped()).pass, true);
  assert.deepEqual(compareReports(skipped(), { findings: [], coverage: [] }).differences, ['Missing Coverage research (whole axis)']);
});

// A merged report from /design-review: the A11Y-01 case's accessibility results, plus the design system adherence axis.
const merged = () => {
  const r = load('A11Y-01');
  r.findings.push({ id: 'design-system/raw-value/node:5:5', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' });
  r.coverage.push({ axis: 'design-system', ref: 'raw-value', status: 'judged' });
  return r;
};

test('with an axis, only that axis is compared, so a merged report passes a one-axis case', () => {
  assert.equal(compareReports(load('A11Y-01'), merged()).pass, false);
  const result = compareReports(load('A11Y-01'), merged(), { axis: 'accessibility' });
  assert.deepEqual(result.differences, []);
  assert.equal(result.pass, true);
});

test('with an axis, links to the other axes are left out, and a difference on the axis still fails', () => {
  const linked = merged();
  linked.findings[0].relatedFindings = ['design-system/raw-value/node:5:5'];
  linked.findings[1].relatedFindings = ['accessibility/1.4.3/node:5:5'];
  assert.deepEqual(compareReports(load('A11Y-01'), linked, { axis: 'accessibility' }).differences, []);

  linked.findings[0].severity = 'serious';
  assert.deepEqual(compareReports(load('A11Y-01'), linked, { axis: 'accessibility' }).differences, [
    'Finding accessibility/1.4.3/node:5:5: severity is "serious", expected "moderate"',
  ]);
});

test('the command compares one axis with --axis, and says so', () => {
  const result = run(['A11Y-01', '-', '--axis', 'accessibility'], JSON.stringify(merged()));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'PASS A11Y-01 (accessibility only)\n');
  assert.equal(run(['A11Y-01', '-'], JSON.stringify(merged())).status, 1);
});

test('the command exits with 2 when --axis has no axis, or one the case expects nothing on', () => {
  assert.equal(run(['A11Y-01', '-', '--axis'], JSON.stringify(merged())).status, 2);
  assert.equal(run(['A11Y-01', '-', '--axes', 'accessibility'], JSON.stringify(merged())).status, 2);
  const nothing = run(['A11Y-01', '-', '--axis', 'research'], JSON.stringify(merged()));
  assert.equal(nothing.status, 2);
  assert.match(nothing.stderr, /research/);
});

test('the command passes a matching report for a case id, with exit code 0', () => {
  const markdown = `# Design review\n\n\`\`\`json\n${JSON.stringify(load('A11Y-01'), null, 2)}\n\`\`\`\n`;
  const result = run(['A11Y-01', saved('report.md', markdown)]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS A11Y-01/);
});

test('the command lists each difference and exits with 1 when a report differs', () => {
  const likely = load('A11Y-01');
  likely.findings[0].certainty = 'likely';
  const result = run(['A11Y-01', '-'], JSON.stringify(likely));
  assert.equal(result.status, 1);
  assert.equal(result.stdout, 'FAIL A11Y-01\n- Finding accessibility/1.4.3/node:5:5: certainty is "likely", expected "confirmed"\n');
});

test('each expected case passes against itself and fails when any compared field changes', () => {
  const entry = (r, ref) => r.coverage.find((c) => c.ref === ref);
  const changes = {
    'A11Y-01': [
      (r) => { r.findings[0].id = 'accessibility/1.4.3/node:5:4'; },
      (r) => { r.findings[0].axis = 'design-system'; },
      (r) => { r.findings[0].severity = 'serious'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings[0].relatedFindings = ['design-system/DS-RAW/node:5:5']; },
      (r) => { r.findings = []; },
      (r) => { entry(r, '1.4.3').status = 'not-readable'; },
    ],
    'A11Y-01-override': [
      (r) => { r.findings[0].severity = 'moderate'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { entry(r, '1.4.3').status = 'not-readable'; },
    ],
    'CLEAN-01': [
      (r) => { r.findings.push({ id: 'accessibility/1.4.3/node:5:8', axis: 'accessibility', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, '1.4.3').status = 'not-applicable'; },
      (r) => { entry(r, '1.1.1').status = 'needs-annotation'; },
      (r) => { r.coverage.pop(); },
      (r) => { r.coverage = []; },
      (r) => { entry(r, '2.5.8').status = 'not-applicable'; },
      (r) => { entry(r, '1.4.11').status = 'not-readable'; },
    ],
    'A11Y-02': [
      (r) => { r.findings[0].certainty = 'confirmed'; },
      (r) => { r.findings[0].id = 'accessibility/1.4.3/node:64:3'; },
      (r) => { entry(r, '1.4.3').status = 'not-readable'; },
      (r) => { entry(r, '1.4.5').status = 'not-applicable'; },
    ],
    'A11Y-03': [
      (r) => { r.findings.pop(); },
      (r) => { r.findings[1].severity = 'serious'; },
      (r) => { r.findings[0].certainty = 'needs-review'; },
      (r) => { entry(r, '2.5.8').status = 'not-readable'; },
    ],
    'A11Y-03-native': [
      (r) => { r.findings[0].id = 'accessibility/2.5.8/node:64:9'; },
      (r) => { r.findings[0].certainty = 'confirmed'; },
      (r) => { entry(r, '2.5.8').status = 'judged'; },
    ],
    'A11Y-04': [
      (r) => { r.findings[0].id = 'accessibility/1.1.1/node:38:2'; },
      (r) => { r.findings[0].severity = 'moderate'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings = []; },
      (r) => { entry(r, '1.1.1').status = 'not-applicable'; },
    ],
    'A11Y-04-coverage-only': [
      (r) => { r.findings.push({ id: 'accessibility/1.1.1/node:38:4', axis: 'accessibility', severity: 'serious', certainty: 'needs-review' }); },
      (r) => { entry(r, '1.1.1').status = 'judged'; },
    ],
    'A11Y-06': [
      (r) => { entry(r, '1.4.10').status = 'not-applicable'; },
      (r) => { entry(r, '2.4.2').status = 'needs-annotation'; },
      (r) => { r.findings.push({ id: 'accessibility/1.4.10/node:38:5', axis: 'accessibility', severity: 'moderate', certainty: 'needs-review' }); },
    ],
    'A11Y-07': [
      (r) => { r.findings[0].id = 'accessibility/2.4.3/node:38:9'; },
      (r) => { r.findings.push({ id: 'accessibility/2.4.3/node:38:9', axis: 'accessibility', severity: 'serious', certainty: 'needs-review' }); },
      (r) => { entry(r, '2.4.3').status = 'judged'; },
      (r) => { entry(r, '2.4.7').status = 'not-applicable'; },
      (r) => { entry(r, '3.2.1').status = 'needs-annotation'; },
    ],
    'A11Y-08': [
      (r) => { r.findings[0].id = 'accessibility/1.4.11/node:38:22'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { entry(r, '2.4.7').status = 'needs-section'; },
      (r) => { entry(r, '1.4.11').status = 'not-applicable'; },
    ],
    'DS-01': [
      (r) => { r.findings[0].id = 'design-system/raw-value/node:45:17'; },
      (r) => { r.findings[0].axis = 'accessibility'; },
      (r) => { r.findings[0].severity = 'minor'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings[0].relatedFindings = ['accessibility/1.4.3/node:45:18']; },
      (r) => { r.findings = []; },
      (r) => { entry(r, 'raw-value').status = 'not-readable'; },
      (r) => { r.coverage = []; },
    ],
    'DS-02': [
      (r) => { r.findings[0].id = 'design-system/raw-value/node:45:20'; },
      (r) => { r.findings[0].certainty = 'needs-review'; },
      (r) => { r.findings.push({ id: 'design-system/raw-value/node:45:19', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'raw-value').status = 'not-applicable'; },
    ],
    'DS-01-no-baseline': [
      (r) => { r.coverage[0].status = 'judged'; },
      (r) => { r.coverage[0].ref = 'raw-value'; },
      (r) => { r.coverage = []; },
      (r) => { r.findings.push({ id: 'design-system/raw-value/node:45:18', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
    ],
    'X-01': [
      (r) => { r.findings[0].relatedFindings = []; },
      (r) => { r.findings[1].relatedFindings = []; },
      (r) => { r.findings[1].relatedFindings.push('design-system/raw-value/node:62:7'); },
      (r) => { r.findings[0].axis = 'accessibility'; },
      (r) => { r.findings[1].severity = 'serious'; },
      (r) => { r.findings.pop(); },
      (r) => { entry(r, 'raw-value').status = 'not-applicable'; },
      (r) => { entry(r, '1.4.3').status = 'not-readable'; },
      (r) => { r.coverage = r.coverage.filter((c) => c.axis !== 'design-system'); },
    ],
    'DS-07': [
      (r) => { r.findings[0].id = 'design-system/unattributed/component:4bf5425db9d53db51af6a3e411b0b4c24d0fdc89'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings = []; },
      (r) => { entry(r, 'unattributed').status = 'not-applicable'; },
    ],
    'DS-07-figma': [
      (r) => { r.findings[0].id = 'design-system/outside-stack/component:4bf5425db9d53db51af6a3e411b0b4c24d0fdc89'; },
      (r) => { r.findings[0].certainty = 'confirmed'; },
      (r) => { entry(r, 'outside-stack').status = 'not-readable'; },
    ],
    'DS-08': [
      (r) => { r.findings[0].id = 'design-system/unattributed/node:88:49'; },
      (r) => { r.findings[0].certainty = 'confirmed'; },
      (r) => { r.findings[0].severity = 'serious'; },
      (r) => { r.findings.push({ ...r.findings[0], id: `${r.findings[0].id}-2` }); },
    ],
    'DS-09': [
      (r) => { r.findings[0].id = 'design-system/outside-stack/node:88:53'; },
      (r) => { r.findings[0].certainty = 'needs-review'; },
      (r) => { r.findings.push({ id: 'design-system/raw-value/node:88:53', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'outside-stack').status = 'not-applicable'; },
    ],
    'DS-09-listed': [
      (r) => { r.findings.push({ id: 'design-system/outside-stack/variable:b990b604c1c8586a12db5558fbe247207ad10b9c', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'outside-stack').status = 'not-applicable'; },
    ],
    'DS-14': [
      (r) => { r.findings.push({ id: 'design-system/outside-stack/variable:ba3f4e8e57bfa23dae3bee3bdae61193bc8f47dc', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'raw-value').status = 'not-applicable'; },
      (r) => { r.coverage.pop(); },
    ],
    'DS-14-foundation-only': [
      (r) => { r.findings.pop(); },
      (r) => { r.findings[1].id = 'design-system/outside-stack/variable:b21ee6f6713d038eea6c6687060d9e168e20c201'; },
      (r) => { r.findings.push({ id: 'design-system/outside-stack/variable:4eebcb0ed3b44b911ef9fd7c65a57edaeef66fe5', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { r.findings[0].certainty = 'likely'; },
    ],
    'DS-04': [
      (r) => { r.findings[0].id = 'design-system/detached-instance/component:33732a6d19dcd570f49c6dae49e669c160b91c27'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings.push({ id: 'design-system/override/node:I119:72;4:3', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'detached-instance').status = 'not-readable'; },
    ],
    'DS-05': [
      (r) => { r.findings[0].id = 'design-system/raw-value/node:119:75'; },
      (r) => { r.findings[0].certainty = 'likely'; },
      (r) => { r.findings[0].severity = 'minor'; },
      (r) => { entry(r, 'override').status = 'not-applicable'; },
    ],
    'DS-06': [
      (r) => { r.findings.push({ id: 'design-system/override/node:I119:92;4:11;4:6', axis: 'design-system', severity: 'moderate', certainty: 'likely' }); },
      (r) => { entry(r, 'override').status = 'not-applicable'; },
      (r) => { entry(r, 'resize').status = 'not-readable'; },
    ],
    'DS-11': [
      (r) => { r.findings.push({ id: 'design-system/resize/node:119:104', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { entry(r, 'resize').status = 'not-applicable'; },
    ],
    'DS-13': [
      (r) => { r.findings.push({ id: 'design-system/raw-value/node:119:109', axis: 'design-system', severity: 'moderate', certainty: 'confirmed' }); },
      (r) => { r.findings[0].id = 'design-system/raw-value/node:119:109'; },
      (r) => { r.findings[0].certainty = 'needs-review'; },
      (r) => { entry(r, 'raw-value').status = 'not-applicable'; },
    ],
  };
  for (const [id, edits] of Object.entries(changes)) {
    assert.equal(compareReports(load(id), load(id)).pass, true, id);
    for (const edit of edits) {
      const changed = load(id);
      edit(changed);
      assert.equal(compareReports(load(id), changed).pass, false, `${id}: ${edit}`);
    }
  }
});

test('the command exits with 2 and says why when it cannot run', () => {
  assert.equal(run([]).status, 2);
  const unknown = run(['NOPE-99', '-'], '{}');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /NOPE-99/);
});
