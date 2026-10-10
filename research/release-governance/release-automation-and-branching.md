# Research: release automation and branching for a no-deploy skills repo

This repo is documentation-only: no compiled code, no `package.json`, no build step. Its "artifacts" are git tags (`v<version>`), GitHub Releases, and a manual Figma publish. `scripts/release.mjs` already stamps a version into every `SKILL.md` (metadata line, body line, pinned reference-document URLs) and runs `check`/`install-check`.

Legend: **[FACT]** = stated in a primary source (linked). **[OPINION]** = assessment, not sourced.

## 1. Release automation tooling fit

### release-please
- Driven by "release types"; the no-package.json escape hatch is `release-type: simple` ("a `version.txt` and a `CHANGELOG.md`") ([strategy table](https://github.com/googleapis/release-please#strategy-language-types-supported)).
- Maintains a standing Release PR; on merge it updates changelog, tags the commit, and creates a GitHub Release ([README](https://github.com/googleapis/release-please#whats-a-release-pr)). Only opens a PR after a `feat`/`fix`/`deps` releasable unit; `chore`/`build` are not releasable.
- `version.txt` is the version source for `simple`; `.release-please-manifest.json` maps package path→version; config in `release-please-config.json` ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)).
- Prereleases via `prerelease: true` + `prerelease-type`; `draft`, `force-tag-creation` ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)).
- Updates arbitrary files via `extra-files` annotations (`x-release-please-version`), which replace a value token — not a version embedded in a URL ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)).

### semantic-release
- Core requirements omit `package.json`; config can live in `.releaserc`/`release.config.*`/`package.json` ([README](https://github.com/semantic-release/semantic-release#requirements); [configuration](https://semantic-release.gitbook.io/semantic-release/usage/configuration#configuration-file)).
- Default plugins include `@semantic-release/npm`, which updates `package.json` and publishes; drop it to leave tag + GitHub Release ([configuration](https://semantic-release.gitbook.io/semantic-release/usage/configuration#plugins); [npm plugin](https://github.com/semantic-release/npm)).

### changesets
- Requires `package.json` and a package manager ([Getting Started](https://changesets.dev/guide/getting-started)). Package-centric; poor fit.

### Custom `release.mjs`
Already does, and none of the tools do out of the box:
- `set <version>` rewrites `metadata.version`, the body Version line, **and the pinned reference-document URL segment** (`/v<version>/…`, or `main` for `-dev`).
- `check` enforces Figma's 64 KiB cap, YAML description quoting, name==folder, version agreement, correct link pinning.
- `install-check` shells out to `npx skills add` and verifies the installed set.

### Comparison (no build, no npm publish, tag + GitHub Release only)

| Criterion | release-please | semantic-release | changesets | Extend `release.mjs` |
|---|---|---|---|---|
| Language manifest needed? | No — `simple` needs `version.txt`+changelog | Core omits package.json; npm plugin default | Yes | No |
| Node runtime | Yes | Yes | Yes | Already |
| Requires Conventional Commits | Yes | Yes (Angular) | No | No |
| Standing Release PR | Yes | No | Yes | You script it |
| Tag + GitHub Release only | Yes | Yes if npm plugin dropped | Aimed at npm publish | You write it |
| Prerelease alpha/beta/rc | Yes | Yes (branches/channels) | Yes | Regex already supports |
| Rewrites version in URLs / Figma checks | No | No | No | Yes |

## 2. Conventional Commits

- Grammar: `<type>[optional scope]: <description>` + body + footers ([spec 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)).
- `fix`→PATCH, `feat`→MINOR; `BREAKING CHANGE:` footer or `!`→MAJOR. Other types allowed with no implicit effect.
- Current repo history is free-text (`Release 0.1.0-alpha.3: …`, `Design Scanner: …`, `Merge: …`) — no Conventional Commits type, so a spec-based tool would parse zero releasable units. Adopting one means a commit-message discipline change (or a squash-PR-title rule). release-please escape hatches: `Release-As: x.x.x` and `BEGIN_COMMIT_OVERRIDE` blocks.

## 3. Trunk-Based Development

- Single trunk, short-lived branches as PRs, "branch should only last a couple of days" ([Short-Lived Feature Branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/)).
- Release branches are cut just-in-time, get no continued development work; bug fixes are made on trunk and cherry-picked to the branch, never the reverse ([Branch for release](https://trunkbaseddevelopment.com/branch-for-release/)).
- "Releasing from a tag on the trunk is a decent optimization… the branch can be avoided completely." CD teams do not do release branches.
- Release branches are not merged back and are deleted after use.

## 4. Integration-Gate Flow — assessment for this repo

[FACT about the article] It is "TBD + one gated `integration` branch" with nightly integration/perf/DAST/chaos/mutation tests; `ai/*` branches; promotion `feature|ai|bugfix → integration → release/vX.Y → main`; `hotfix/*` the only sideways branch; `experiment/*` cherry-pick only; squash-only signed `main` ([hellodk.io](https://hellodk.io/ai-git-branching-strategy)).

Assessment for this repo (no deploy, artifact = a tag) [OPINION]:

| Element | Value here | Why |
|---|---|---|
| Short-lived `feature/*` / `ai/*` | **Keep** | Matches TBD; `ai/*` is a naming/provenance convention, not a mechanism. |
| Supervised `integration` branch | **Ceremony** | Its purpose is the nightly test battery — there is no runtime to DAST, no perf surface, no chaos targets. The real tests (`release.mjs check`, `install-check`) run in seconds and can gate PRs to `main` directly. |
| Security gates (SAST/SCA/SBOM/SLSA) | **Ceremony** | No code, no dependencies, no containers. |
| `release/*` branch | **Usually ceremony** | TBD: release from a tag is the cheaper optimization. Keep only if patching older major lines. |
| `hotfix/*` | **Ceremony unless back-porting** | Earns its keep only if maintaining released versions separately; otherwise fix forward. |
| `experiment/*` | **Optional** | Pure convention. |
| Squash-only `main` | **Keep** | Linear history, 1:1 commit↔PR; release-please recommends it. |
| CODEOWNERS / branch protection / no force-push | **Keep** | GitHub-native guards; cheap, real. |

[FACT] Merge queue serializes concurrent merges and needs the `merge_group` event ([Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)); [OPINION] adds little at this PR volume. [OPINION] A `release/*` branch buys (1) a frozen point for longer verification and (2) a place to cherry-pick a patch onto a published line — not a third sense of "hardening", which a tag already provides.

## 5. GitHub release mechanics

- Releases are based on git tags; a tag date and release date can differ; source archives auto-attach ([About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)).
- `gh release create [<tag>]` creates the tag from the default branch if absent; `--target` points elsewhere; `--verify-tag` aborts if the tag doesn't exist. `--notes-from-tag` reads an annotated tag. `--prerelease`/-p marks a pre-release. `--draft`, `--generate-notes`, `--fail-on-no-commits` ([gh release create](https://cli.github.com/manual/gh_release_create)).
- If not set as latest, the latest label is assigned by semver ([Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)).
- Immutable releases: assets and tag cannot change after publish; enabling it generates a release attestation. Recommended workflow: draft → attach → publish. `gh` drafts-then-publishes when assets are passed ([Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)).

## 6. Minimal viable model for a no-deploy skills repo

### (a) Branch model
| Branch | Keep? | Role |
|---|---|---|
| `main` | **Yes** | Single trunk; protected; squash-only; no force-push; tag releases here. |
| `feature/*` (+ optional `ai/*` naming) | **Yes** | Short-lived, PR into `main`. |
| `release/*` | **Only if** patching a previously released major line; else drop. | |
| `integration` | **No** | Justified by a nightly battery this repo has no target for. |
| `hotfix/*` | **No** (fix forward) unless supporting old lines. | |
| `experiment/*` | **Optional** convention. | |
| Merge queue | **Not yet** | Revisit if PR volume grows. |

Plain TBD with short-lived branches + release-from-a-tag.

### (b) Tooling
[OPINION] Extend `release.mjs`; optionally borrow release-please for the last mile only.
- No tool stamps the version into every `SKILL.md` **and** rewrites it inside pinned reference-document URLs; release-please's `extra-files` replaces a token, not a URL path.
- A tool does what the script doesn't: decide the bump from commit messages, maintain a Release PR, create tag + Release.
- Pragmatic split: keep `release.mjs` as source of truth for stamping + `check` + `install-check`; drive tag + `gh release create` from it, adding `--prerelease` when the version matches `-alpha/-beta/-rc`. If a standing Release PR is wanted, adopt release-please with `release-type: simple` + `version.txt` and run `release.mjs set` in the Release PR before merge.
- Adopting release-please is only worthwhile once the repo writes Conventional Commits (or enforces a squash-PR-title rule) and accepts `version.txt`/manifest files.

### (c) Tags + Releases + Figma publish
1. Land work on `main` via short-lived squash-merged PRs.
2. `node scripts/release.mjs set <version>` and `check --release <version>`; commit the stamped `SKILL.md`s.
3. Create an **annotated** tag `v<version>`; push.
4. `gh release create v<version> --verify-tag --notes-file …`, adding `--prerelease` for alpha/beta/rc.
5. If immutable releases are enabled, draft → publish.
6. The **manual Figma publish** stays manual — the one step outside version control; record it in the Release notes. This is why heavier `integration`/`release/*` ceremony buys nothing: the genuinely gated human step is outside git.

### Opinion flags
- Section 4 value/ceremony calls, the merge-queue "not yet", and the `release/*`/`hotfix/*` "drop" calls are [OPINION].
- Sections (b) and (c) recommendations are [OPINION]; their mechanics are cited [FACT].
- "release-please cannot rewrite a version inside a URL" is an [OPINION] inference from the documented `extra-files` model.

### Primary sources
- release-please: [README](https://github.com/googleapis/release-please), [customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md), [manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- semantic-release: [README](https://github.com/semantic-release/semantic-release), [configuration](https://semantic-release.gitbook.io/semantic-release/usage/configuration), [npm plugin](https://github.com/semantic-release/npm)
- changesets: [Getting Started](https://changesets.dev/guide/getting-started)
- Conventional Commits: [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/)
- Trunk-Based Development: [Introduction](https://trunkbaseddevelopment.com/), [Short-Lived Feature Branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/), [Branch for release](https://trunkbaseddevelopment.com/branch-for-release/)
- Integration-Gate Flow: [hellodk.io](https://hellodk.io/ai-git-branching-strategy)
- GitHub: [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases), [Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [gh release create](https://cli.github.com/manual/gh_release_create)
- Repo-local: [`scripts/release.mjs`](../../scripts/release.mjs), `git log`.
