# Research: how the `skills` CLI versions and updates published skills

Read-only investigation. Primary sources are the CLI's own source (`vercel-labs/skills`, commit `13e4063a1cf913f5606d57d42ab83a86f5001e04`, npm `skills@1.7.2`), its Mintlify docs, the Agent Skills spec, and Claude Code docs. This repo's own `skills-lock.json` and tags are used as a worked example.

## 1. What is the package behind `npx skills`?

- **npm package:** `skills` — https://www.npmjs.com/package/skills (latest `1.7.2`).
- **GitHub repo:** https://github.com/vercel-labs/skills.
- **Maintainer:** Vercel Labs (`rauchg`, `quuu`).
- Installs `SKILL.md` skill dirs into many agents (`.claude/skills/`, `.agents/skills/`, ~75 paths).

`add-skill` (vercel-labs/add-skill) is a separate, older package. The command in question resolves to `skills`.

## 2. How `add` resolves which version to install

**It installs the current content of the repo's default branch (or an explicitly requested git ref). No version/tag/release/semver selection, no lockfile-driven pinning.**

- The source parser understands an optional git **ref** via a `#ref` fragment or `/tree/<ref>/...` URL. No version or tag syntax.
  - `parseFragmentRef`: `owner/repo#<ref>` and `owner/repo#<ref>@<skill>` — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/source-parser.ts#L284-L314
  - Tree URL parsing sets `ref` — same file, lines 431-452.
- No ref given → clone uses the default branch: `git clone --depth 1` with `--branch <ref>` only if a ref was given — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/git.ts#L295-L306
  - GitHub API fast path tries `['HEAD', 'main', 'master']` — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/blob.ts#L235-L240
- Snapshot fast path is explicitly **not** bound to any ref; bypassed when a ref is requested — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/blob.ts#L563-L567
- **`metadata.version` is never read** for install selection. Only `name`/`description` (plus `metadata.internal`) are parsed — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/blob.ts#L611-L633, https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/frontmatter.ts#L8-L16

## 3. How `update` decides a newer version exists

**By comparing a content hash of the skill folder at the recorded ref (or default branch) against the hash recorded at install time. Never tags/commits/version fields.**

Docs: "The CLI compares the GitHub tree SHA of your installed skills against the latest version in the repository." — https://vercel-labs-skills.mintlify.app/quickstart

- Global installs: fetch repo tree at recorded ref, compare folder tree SHA — https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/update.ts#L597-L603
- Fallback: clone and hash — same file lines 614-656.
- Project installs: clone at recorded ref and compare `computeSkillFolderHash` to `computedHash` — same file lines 904-941.
- Pre-releases only matter if they are the content of the tracked ref. No `git ls-remote`, no releases API, no semver anywhere. If a consumer installed with no ref, pre-release tags are invisible. If they pinned `#v0.1.0-alpha.4`, updates stay pinned to that ref.

## 4. Does the Agent Skills spec define `version` / `metadata.version`?

**No.** Spec fields: `name` (required), `description` (required), `license`, `compatibility`, `metadata`, `allowed-tools`. `metadata` is "a map from string keys to string values… store additional properties not defined by the Agent Skills spec." The only place `version` appears is an example (`metadata: { author, version: "1.0" }`) — illustrative, no semantics.

- https://agentskills.io/specification (source: https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx)
- Claude Code corroborates the six spec fields — https://code.claude.com/docs/en/skills
- Third-party `agentskills.my` advertises a top-level `version` field; **not** the official spec, not implemented by the CLI.

## 5. Semver ranges, tag pinning, channels?

- **Semver ranges: no.** No semver library in the CLI.
- **Tag/ref pinning: yes, as a raw git ref** (`#<ref>`, `/tree/<ref>`, Azure `GT<tag>`, raw SHA). Chosen ref persisted in lock and reused on update.
- **Channels (alpha/beta): no.**

## 6. Implications for a publisher shipping pre-releases

1. Consumers track the default branch unless they pin a ref.
2. **Git tags are inert to the tool.** Publishing `v0.1.0-alpha.4` changes nothing for an unpinned consumer.
3. **`metadata.version` is cosmetic.** A `-dev` value on the default branch gates nothing.
4. **Update detection is content-based** — any commit to the tracked ref is offered as an update, regardless of version/tag/release.

### Worked example (this repo)
- Tags `v0.1.0-alpha.1..3` exist.
- `skills-lock.json` records `source`/`sourceType`/`skillPath`/`computedHash`, **no `ref`, no `version`**.
- Consumers who ran `npx skills add <owner>/<repo>` are on the default branch; alpha tags never reach them.

To limit consumers to a pre-release or stable line, the only lever is the tracked ref. No channel/range support.

## Consumer lockfile use on `add` and `update`

1. **Project lockfile `skills-lock.json`** (committed): fields `source`, `sourceUrl?`, `ref?`, `sourceType`, `skillPath?`, `version?`, `via?`, `computedHash`, `subagents?`, `wellKnownDigest?`. `computedHash` = SHA-256 of all files in the skill folder. `version` is the npm-package version for `node_modules` sources only, not the skill version. `add` writes the entry; `update` reads it and compares `computedHash` to a fresh clone; the ref is reused.
   - https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/local-lock.ts
   - https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/sync.ts#L781-L790
   - https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/update.ts#L844-L941
2. **Global lockfile `~/.agents/.skill-lock.json`**: per skill `source`, `ref?`, `skillPath?`, `skillFolderHash` (GitHub tree SHA), timestamps. `version: 3` is the lock schema version. Compared on `update`.
   - https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/src/skill-lock.ts#L24-L29

## What this means for a publisher

- **The default branch, not git tags, controls what consumers install** (unless a consumer pins a ref).
- **Consumers install content, not versions** — no semver, tags, releases, or `metadata.version` are read.
- **Pre-releases do not leak via tags, but they do leak via the default branch.** A `-dev` value on the default branch is delivered to unpinned consumers because the CLI never gates on a version string.
- **The lockfile records a content hash + source/ref, not a version.**

### Explicit uncertainties
- The spec is `agentskills.io`; `agentskills.my` claims a top-level `version` field but is non-authoritative.
- Findings pinned to `skills@1.7.2` / commit `13e4063…`; re-check if the CLI adds tag/semver logic.
