// Release tooling for the design review skills (docs/publishing.md): sets and checks the set's version, and checks an install.
//   node scripts/release.mjs set <version>
//   node scripts/release.mjs check [--release] [<version>]
//   node scripts/release.mjs install-check <source>
// Add --root <folder> to work on another repo root than this one.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage:
  node scripts/release.mjs set <version>
  node scripts/release.mjs check [--release] [<version>]
  node scripts/release.mjs install-check <source>
Add --root <folder> to work on another repo root.`;

const SEMVER = /^\d+\.\d+\.\d+(-dev)?$/;
const META_VERSION = /^(  version: ")([^"\n]*)(")$/m;
const BODY_VERSION = /^(Version )(\S+)( of the design review skills\.)$/m;
const REF_LINK = /(https:\/\/raw\.githubusercontent\.com\/Blind3y3Design\/design-review-skills\/)([^/\s`]+)(\/reference-documents\/[^\s`)]*)/g;

// A -dev version reads Reference Documents from main, a release from its own tag.
const refFor = (version) => (version.endsWith('-dev') ? 'main' : `v${version}`);

const skillFolders = (root) => {
  const dir = join(root, 'skills');
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
};
const skillPath = (root, folder) => join(root, 'skills', folder, 'SKILL.md');

function setVersion(root, version) {
  if (!SEMVER.test(version)) return { errors: [`${version} is not a semantic version: write it as 1.2.3, or 1.2.3-dev for a version in development`] };
  const updates = [];
  const errors = [];
  for (const folder of skillFolders(root)) {
    const file = skillPath(root, folder);
    if (!existsSync(file)) continue;
    let text = readFileSync(file, 'utf8');
    if (!META_VERSION.test(text)) errors.push(`${folder}: no metadata.version`);
    if (!BODY_VERSION.test(text)) errors.push(`${folder}: no "Version … of the design review skills" line`);
    text = text.replace(META_VERSION, `$1${version}$3`).replace(BODY_VERSION, `$1${version}$3`).replace(REF_LINK, `$1${refFor(version)}$3`);
    updates.push([file, text]);
  }
  if (errors.length) return { errors };
  for (const [file, text] of updates) writeFileSync(file, text);
  return { errors: [], count: updates.length };
}

function checkRelease(root, { release = false, version = null } = {}) {
  const problems = [];
  const skills = [];
  for (const folder of skillFolders(root)) {
    const file = skillPath(root, folder);
    if (!existsSync(file)) {
      problems.push(`${folder}: has no SKILL.md`);
      continue;
    }
    const extras = readdirSync(join(root, 'skills', folder)).filter((f) => f !== 'SKILL.md');
    if (extras.length) problems.push(`${folder}: holds ${extras.join(', ')} besides SKILL.md`);
    const text = readFileSync(file, 'utf8');
    const name = (text.match(/^name: (.*)$/m) || [])[1];
    if (name !== folder) problems.push(`${folder}: name is "${name}", not the folder's`);
    const meta = (text.match(META_VERSION) || [])[2];
    const body = (text.match(BODY_VERSION) || [])[2];
    if (!meta) problems.push(`${folder}: no metadata.version`);
    if (!body) problems.push(`${folder}: no "Version … of the design review skills" line`);
    if (meta && body && meta !== body) problems.push(`${folder}: metadata.version is ${meta} but the body says ${body}`);
    skills.push({ folder, text, meta });
  }
  if (!skills.length) problems.push('no skills found under skills/');

  let setAt = version;
  if (!setAt) {
    const counts = new Map();
    for (const s of skills) if (s.meta) counts.set(s.meta, (counts.get(s.meta) || 0) + 1);
    setAt = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
  }
  for (const s of skills) {
    if (s.meta && setAt && s.meta !== setAt) problems.push(version ? `${s.folder}: version ${s.meta}, expected ${version}` : `${s.folder}: version ${s.meta}, but the set is at ${setAt}`);
    if (release && s.meta?.endsWith('-dev')) problems.push(`${s.folder}: ${s.meta} is a -dev version, and a release isn't`);
    if (setAt) for (const [, , ref, rest] of s.text.matchAll(REF_LINK)) {
      if (ref !== refFor(setAt)) problems.push(`${s.folder}: the link …/${ref}${rest} should point at ${refFor(setAt)}`);
    }
  }
  if (release && !version && setAt?.endsWith('-dev') && !problems.some((p) => p.includes('-dev version'))) problems.push(`the set is at ${setAt}, a -dev version, and a release isn't`);
  return { problems, count: skills.length, setAt };
}

function installCheck(root, source) {
  const scratch = mkdtempSync(join(tmpdir(), 'install-check-'));
  const cli = process.env.SKILLS_CLI || 'npx -y skills';
  const run = spawnSync(`${cli} add ${JSON.stringify(source)} --all`, { cwd: scratch, shell: true, encoding: 'utf8' });
  if (run.status !== 0) return { problems: [`the skills CLI failed with status ${run.status}: ${(run.stderr || run.stdout || '').trim().split('\n').pop()}`], scratch };
  const dir = join(scratch, '.agents', 'skills');
  const installed = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name).sort() : [];
  const expected = skillFolders(root);
  const extra = installed.filter((n) => !expected.includes(n));
  const missing = expected.filter((n) => !installed.includes(n));
  const problems = [];
  if (extra.length) problems.push(`installed but not in skills/: ${extra.join(', ')}`);
  if (missing.length) problems.push(`in skills/ but not installed: ${missing.join(', ')}`);
  return { problems, count: installed.length, scratch };
}

function report(label, problems, passLine) {
  if (problems.length) {
    console.log([`FAIL ${label}`, ...problems.map((p) => `- ${p}`)].join('\n'));
    return 1;
  }
  console.log(`PASS ${passLine}`);
  return 0;
}

function main(argv) {
  const args = [...argv];
  let root = fileURLToPath(new URL('..', import.meta.url));
  const at = args.indexOf('--root');
  if (at !== -1) root = args.splice(at, 2)[1] ?? '';
  const [command, ...rest] = args;
  const usage = () => {
    console.error(USAGE);
    return 2;
  };

  if (command === 'set') {
    if (rest.length !== 1) return usage();
    const result = setVersion(root, rest[0]);
    if (result.errors.length) {
      console.error(result.errors.join('\n'));
      return 2;
    }
    console.log(`Set ${result.count} skills to ${rest[0]}, with default links pinned to ${refFor(rest[0])}.`);
    return 0;
  }
  if (command === 'check') {
    const release = rest.includes('--release');
    const others = rest.filter((a) => a !== '--release');
    if (others.length > 1 || (others[0] && !SEMVER.test(others[0]))) return usage();
    const result = checkRelease(root, { release, version: others[0] || null });
    return report('check', result.problems, `${result.count} skills at ${result.setAt}, links pinned to ${refFor(result.setAt)}`);
  }
  if (command === 'install-check') {
    if (rest.length !== 1) return usage();
    const result = installCheck(root, rest[0]);
    return report('install-check', result.problems, `install-check: ${result.count} skills installed from ${rest[0]}, exactly the ones in skills/ (scratch project ${result.scratch})`);
  }
  return usage();
}

process.exitCode = main(process.argv.slice(2));
