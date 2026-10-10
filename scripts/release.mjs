// Release tooling for the design review skills (docs/publishing.md). package.json's "version" is the set's source of truth:
// release-please owns it (and CHANGELOG.md) and stamps every version surface through x-release-please-version markers;
// `set` stays as a local/emergency writer, `check` and `install-check` only read.
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

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(alpha|beta|rc)\.(0|[1-9]\d*))?$/;
// Each version surface carries an x-release-please-version marker, which is how release-please finds it; the regexes accept a line without one so `set` can stamp an unmarked tree.
const META_VERSION = /^(  version: ")([^"\n]*)("(?: # x-release-please-version)?)$/m;
const BODY_VERSION = /^(Version )(\S+)( of the design review skills\.)( <!-- x-release-please-version -->)?$/m;
// Figma rejects a skill longer than this many characters (not bytes). Counted as JavaScript counts, so an emoji is two: the safe side.
const MAX_SKILL_CHARS = 65536;
const thousands = (n) => n.toLocaleString('en-US');
const REF_LINK = /(https:\/\/raw\.githubusercontent\.com\/Blind3y3Design\/design-review-skills\/)([^\s`]+?)(\/reference-documents\/[^\s`)]*)/g;

// Every version is released, so a default Reference Document link always points at the version's own tag.
const refFor = (version) => `v${version}`;

const skillFolders = (root) => {
  const dir = join(root, 'skills');
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
};
const skillPath = (root, folder) => join(root, 'skills', folder, 'SKILL.md');

// The version's source of truth: package.json. Returns the version, or the problem that keeps it from being read.
function packageVersion(root) {
  const file = join(root, 'package.json');
  if (!existsSync(file)) return { version: null, problem: 'no package.json at the root to read the version from' };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { version: null, problem: `package.json is not readable as JSON: ${error.message}` };
  }
  if (typeof pkg.version !== 'string' || !pkg.version) return { version: null, problem: 'package.json has no version' };
  return { version: pkg.version, problem: null };
}

function setVersion(root, version) {
  if (!SEMVER.test(version)) return { errors: [`${version} is not a semantic version: write it as 1.2.3, or 1.2.3-alpha.1 (or beta, rc) for a pre-release`] };
  const pkgFile = join(root, 'package.json');
  if (!existsSync(pkgFile)) return { errors: ['no package.json at the root: set writes the version there, as its source of truth'] };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  } catch (error) {
    return { errors: [`package.json is not readable as JSON: ${error.message}`] };
  }
  const updates = [];
  const errors = [];
  for (const folder of skillFolders(root)) {
    const file = skillPath(root, folder);
    if (!existsSync(file)) {
      errors.push(`${folder}: has no SKILL.md`);
      continue;
    }
    let text = readFileSync(file, 'utf8');
    if (!META_VERSION.test(text)) errors.push(`${folder}: no metadata.version`);
    if (!BODY_VERSION.test(text)) errors.push(`${folder}: no "Version … of the design review skills" line`);
    text = text.replace(META_VERSION, `$1${version}$3`).replace(BODY_VERSION, `$1${version}$3$4`).replace(REF_LINK, `$1${refFor(version)}$3`);
    updates.push([file, text]);
  }
  if (errors.length) return { errors };
  writeFileSync(pkgFile, JSON.stringify({ ...pkg, version }, null, 2) + '\n');
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
    const extras = readdirSync(join(root, 'skills', folder)).filter((f) => f !== 'SKILL.md' && !f.startsWith('.'));
    if (extras.length) problems.push(`${folder}: holds ${extras.join(', ')} besides SKILL.md`);
    const text = readFileSync(file, 'utf8');
    if (text.length > MAX_SKILL_CHARS) problems.push(`${folder}: ${thousands(text.length)} characters, over the ${thousands(MAX_SKILL_CHARS)} Figma allows in a skill`);
    const name = (text.match(/^name: (.*)$/m) || [])[1];
    const description = (text.match(/^description: (.*)$/m) || [])[1] ?? '';
    if (!/^["']/.test(description) && /: | #/.test(description)) problems.push(`${folder}: the description has ": " or " #" in an unquoted value, which isn't valid YAML and keeps \`npx skills add\` from installing the skill: reword it or quote it`);
    if (name !== folder) problems.push(`${folder}: name is "${name}", not the folder's`);
    const meta = (text.match(META_VERSION) || [])[2];
    const body = (text.match(BODY_VERSION) || [])[2];
    if (!meta) problems.push(`${folder}: no metadata.version`);
    if (!body) problems.push(`${folder}: no "Version … of the design review skills" line`);
    if (meta && body && meta !== body) problems.push(`${folder}: metadata.version is ${meta} but the body says ${body}`);
    skills.push({ folder, text, meta });
  }
  if (!skills.length) problems.push('no skills found under skills/');

  // The version to check against: the one given, else package.json's.
  let setAt = version;
  if (!setAt) {
    const fromPackage = packageVersion(root);
    if (fromPackage.problem) problems.push(fromPackage.problem);
    else if (!SEMVER.test(fromPackage.version)) problems.push(`package.json's version ${fromPackage.version} is not a semantic version`);
    else setAt = fromPackage.version;
  }
  for (const s of skills) {
    if (s.meta && setAt && s.meta !== setAt) problems.push(version ? `${s.folder}: version ${s.meta}, expected ${version}` : `${s.folder}: version ${s.meta}, but the set is at ${setAt}`);
    if (release && s.meta?.endsWith('-dev')) problems.push(`${s.folder}: ${s.meta} is a -dev version, and a release isn't`);
    if (setAt) for (const [, , ref, rest] of s.text.matchAll(REF_LINK)) {
      if (ref !== refFor(setAt)) problems.push(`${s.folder}: the link …/${ref}${rest} should point at ${refFor(setAt)}`);
    }
  }
  return { problems, count: skills.length, setAt };
}

function installCheck(root, source) {
  const scratch = mkdtempSync(join(tmpdir(), 'install-check-'));
  const [bin, ...prefix] = (process.env.SKILLS_CLI || 'npx -y skills').split(' ');
  const run = spawnSync(bin, [...prefix, 'add', source, '--all'], { cwd: scratch, encoding: 'utf8' });
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
  if (at !== -1) {
    root = args.splice(at, 2)[1];
    if (!root) {
      console.error(USAGE);
      return 2;
    }
  }
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
    console.log(`Set package.json and ${result.count} skills to ${rest[0]}, with default links pinned to ${refFor(rest[0])}.`);
    return 0;
  }
  if (command === 'check') {
    const release = rest.includes('--release');
    const others = rest.filter((a) => a !== '--release');
    if (others.length > 1 || (others[0] && !SEMVER.test(others[0]))) return usage();
    const result = checkRelease(root, { release, version: others[0] || null });
    return report('check', result.problems, result.setAt ? `${result.count} skills at ${result.setAt}, links pinned to ${refFor(result.setAt)}` : '');
  }
  if (command === 'install-check') {
    if (rest.length !== 1) return usage();
    const result = installCheck(root, rest[0]);
    return report('install-check', result.problems, `install-check: ${result.count} skills installed from ${rest[0]}, exactly the ones in skills/ (scratch project ${result.scratch})`);
  }
  return usage();
}

process.exitCode = main(process.argv.slice(2));
