# Research: SemVer for a set of agent skills

Research only. Every factual claim is cited to a primary source URL.

## 1. semver.org: MAJOR / MINOR / PATCH, pre-release, build metadata

- MAJOR — "incompatible API changes"; MINOR — "add functionality in a backward compatible manner"; PATCH — "backward compatible bug fixes" ([§Summary](https://semver.org/#summary)).
- The spec **requires a declared "public API."** "Software using Semantic Versioning MUST declare a public API. This API could be declared in the code itself or exist strictly in documentation." ([§spec-item-1](https://semver.org/#spec-item-1)). This is the hook that lets a content artifact be versioned.
- Increment rules ([§6](https://semver.org/#spec-item-6), [§7](https://semver.org/#spec-item-7), [§8](https://semver.org/#spec-item-8)): PATCH resets nothing; MINOR resets PATCH; MAJOR resets MINOR+PATCH. A deprecated public API feature MUST bump MINOR.
- Releases are immutable: "Once a versioned package has been released, the contents of that version MUST NOT be modified." ([§3](https://semver.org/#spec-item-3)).
- Pre-release identifiers ([§9](https://semver.org/#spec-item-9)): hyphen + dot-separated ASCII alphanumerics/hyphens, non-empty, numeric parts no leading zeros. `1.0.0-alpha`, `1.0.0-alpha.1`. The spec names no vocabulary; `alpha`/`beta`/`rc` are conventions, not spec.
- `-dev` is a legal identifier (non-empty ASCII-alphanumeric).
- **Ordering trap** ([§11, sub-rule 4](https://semver.org/#spec-item-11)): `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0`. Identifiers with letters/hyphens compare **lexically in ASCII order**. In ASCII `a` < `d`, so:

  ```
  0.1.0-alpha.1  <  0.1.0-beta  <  0.1.0-dev  <  0.1.0-rc.1  <  0.1.0
  ```

  `-dev` sorts **after** `alpha`/`beta` and before `rc`, the opposite of the usual "earliest build" intuition. Flag to a human.
- Build metadata `+dev` ([§10](https://semver.org/#spec-item-10)): legal, but **ignored for precedence** — `0.1.0+dev` equals `0.1.0`. Unsuitable for "next version ahead of release".

## 2. The `0.y.z` range

> "Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public API SHOULD NOT be considered stable." ([§4](https://semver.org/#spec-item-4))

> "Version 1.0.0 defines the public API." ([§5](https://semver.org/#spec-item-5))

FAQ: "start your initial development release at 0.1.0 and then increment the minor version for each subsequent release"; move to 1.0.0 when "used in production" / "stable API" / "worrying a lot about backward compatibility" ([FAQ](https://semver.org/#how-should-i-deal-with-revisions-in-the-0yz-initial-development-phase), [FAQ 1.0.0](https://semver.org/#how-do-i-know-when-to-release-100)).

## 3. How tools model pre-releases and a development version

### release-please
- `fix:`→patch, `feat:`→minor, `feat!`/`fix!`/etc.→major ([README](https://github.com/googleapis/release-please#how-should-i-write-my-commits)). Releasable units: `feat`, `fix`, `deps` ([Step 1](https://github.com/googleapis/release-please#step-1-ensure-releasable-units-are-merged)).
- Pre-1.0: `"bump-minor-pre-major"` (BREAKING bumps minor while <1.0.0), `"bump-patch-for-minor-pre-major"` (feat bumps patch while <1.0.0) ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)).
- Prerelease strategy `prerelease` + `prerelease-type: beta`, only when `prerelease: true` ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md), [manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)).
- Non-JS supported: `simple` ("a `version.txt` and a `CHANGELOG.md`"), plus generic updater with `x-release-please-version` annotations ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)).

### semantic-release
- Branches can be `release`/`maintenance`/`pre-release`; `prerelease: beta` → `2.0.0-beta.1` ([workflow-configuration](https://semantic-release.org/foundation/workflow-configuration/)).
- Config may live in `.releaserc`/`release.config.*`/`package.json`, but the **default plugin set includes `@semantic-release/npm`**, which updates `package.json` and publishes ([configuration](https://semantic-release.org/usage/configuration/#plugins), [npm plugin](https://github.com/semantic-release/npm)). A git-only pipeline must drop/replace the npm plugin. Node is a hard runtime.

### changesets
- `changeset pre enter <tag>` / `pre exit` ([prereleases](https://changesets.dev/guide/prereleases)).
- **Requires `package.json`** with `name`/`private`/`version`, plus Node `^22.11 || ^24 || >=26` and a package manager ([Beyond npm](https://changesets.dev/guide/beyond-npm), [Getting Started](https://changesets.dev/guide/getting-started)). Least suitable here.

## 4. Mapping MAJOR/MINOR/PATCH for a non-code artifact

- Spec only requires a declarable public API, which "could… exist strictly in documentation" ([§1](https://semver.org/#spec-item-1)).
- **Docs precedent is unsettled.** [semver/semver#609](https://github.com/semver/semver/issues/609): opener `epement-db` proposed heading-based mapping (main headings→Major, subheadings→Minor, body→Patch); ljharb argued docs-only is "obviously patch"; Nixinova proposed build metadata `1.0.0+doc.1`. No standard.
- **Agent Skills precedent is unsettled.** `SKILL.md` has no first-class `version`; `metadata` is a free-form map ([spec](https://agentskills.io/specification)). Two unadopted proposals:
  - [#420](https://github.com/agentskills/agentskills/discussions/420): MAJOR = different inputs required / output format changed / instructions fundamentally rewritten; MINOR = new capability / expanded instructions; PATCH = typo/clarification, no behaviour change.
  - [#415](https://github.com/agentskills/agentskills/discussions/415): a "Skill Contract" = input schema / output schema / behavioral expectations / error semantics / tool invocation. Closed, consolidated into #420. Open questions: "Should prompt-only changes always be PATCH?" and "Should behavioral changes without schema changes require MAJOR?"
  - Counter-view in #420 (`jonathanhefner`): contracts are "much looser than code"; favors CalVer or an opaque `metadata.version`. `bbrewington` and `yordis` also favor CalVer / a counter / a commit SHA.

**Defensible mapping for a skill set** (matches #420/#415, not mandated by the spec):
- **MAJOR** — breaking change to a skill's declared input/output contract; renamed/removed skill; report/artifact schema change that breaks consumers; change to the required install set / discovery paths.
- **MINOR** — a new skill; a new optional input; additive output/report fields; new capability; deprecation notice.
- **PATCH** — wording/prompt clarifications, typo fixes, internal reordering, non-behavioural edits.

## 5. Conventional Commits

- `fix:`→PATCH, `feat:`→MINOR; `BREAKING CHANGE:` footer or `!`→MAJOR regardless of type ([§Summary](https://www.conventionalcommits.org/en/v1.0.0/#summary), [FAQ](https://www.conventionalcommits.org/en/v1.0.0/#how-does-this-relate-to-semver)).
- Other types allowed (`build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, …) with **no implicit SemVer effect** unless breaking ([§14](https://www.conventionalcommits.org/en/v1.0.0/#specification)).
- `BREAKING CHANGE` must be uppercase; `!` goes immediately before `:`; `BREAKING-CHANGE` is a synonym.
- Angular preset: `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test` ([config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional)).
- Default preset bumps: `feat`/`feature`→minor, `fix`/`perf`/`revert`→patch, breaking→major; `docs/style/chore/refactor/test/build/ci` are hidden and bump nothing ([constants.js](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-conventionalcommits/src/constants.js), [whatBump.js](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-conventionalcommits/src/whatBump.js), [semantic-release rules](https://github.com/semantic-release/commit-analyzer/blob/master/lib/default-release-rules.js)).
- Custom types (`security:`, `ai:`) are legal but need explicit bump rules and changelog-section config ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)).

## 6. `-dev` vs semver ordering and default-branch consumers

- Precedence is major/minor/patch first, then pre-release ([§11](https://semver.org/#spec-item-11)). So `0.2.0-dev > 0.1.0 > 0.1.0-dev`, and `0.2.0-dev < 0.2.0`.
- npm ranges exclude prereleases unless the range opts in ([node-semver](https://github.com/npm/node-semver#prerelease-tags)). `^0.1.0` = `>=0.1.0 <0.2.0-0`, so it never selects `0.2.0-dev`.
- A `-dev` build published to the `latest` dist-tag installs by default regardless — channels matter, not precedence.
- `X.(Y+1).0-dev` is a **valid monotonic** "next version" marker, but because it is a prerelease ordinary ranges won't select it; publish to a non-`latest` channel/ref.
- Do not use `+dev` for sequencing.

## Recommended policy shape (draft — `⚠ DECIDE` items are not settled by any source)

### Version form
Adopt SemVer 2.0.0, one version for the whole set. No `v` in the semver string; `v` belongs on the git tag ([FAQ](https://semver.org/#is-v123-a-semantic-version)).

### Declare the public API (required first step)
Write down that the versioned API is: **(a)** the set of skill names, **(b)** each skill's declared input/output contract, **(c)** discovery paths / required install set ([§1](https://semver.org/#spec-item-1)). `⚠ DECIDE`: exactly which surface is contract (is a `description:` wording change contract? is the report schema?).

### Bump triggers
- **PATCH** — backward-compatible fix, no contract change ([§6](https://semver.org/#spec-item-6)).
- **MINOR** — additive: new skill, optional input, additive output, deprecation ([§7](https://semver.org/#spec-item-7)).
- **MAJOR** — breaking: renamed/removed skill, changed required inputs or output schema, changed required install set ([§8](https://semver.org/#spec-item-8); [#415](https://github.com/agentskills/agentskills/discussions/415), [#420](https://github.com/agentskills/agentskills/discussions/420)).

### 0.y.z vs 1.0.0
Stay `0.y.z` while pre-stable, increment minor per release ([§4](https://semver.org/#spec-item-4), [FAQ](https://semver.org/#how-should-i-deal-with-revisions-in-the-0yz-initial-development-phase)). Move to 1.0.0 once others depend on it. `⚠ DECIDE`.

### Pre-release identifiers
Use `-alpha.N`, `-beta.N`, `-rc.N` ([§9](https://semver.org/#spec-item-9)). **Avoid `-dev` as a "next version" channel** — it sorts between `beta` and `rc` ([§11.4.2](https://semver.org/#spec-item-11)). If a development marker is needed, use a clearly-ordered scheme or a branch/ref concept instead. `⚠ DECIDE`.

### Commit types and automation (if adopting Conventional Commits)
Map `fix→PATCH`, `feat→MINOR`, `!`/`BREAKING CHANGE→MAJOR`. `docs/style/chore/refactor/test/build/ci` bump nothing by default. `⚠ DECIDE`: does adding a skill map to `feat` (MINOR)? do content-only edits map to `docs` (no release) or a custom `content:` type mapped to PATCH?

### Tooling fit
- changesets — needs `package.json`. Poor fit.
- semantic-release — `package.json`-shaped by default. Needs plugin surgery.
- release-please — best fit: `simple` (version.txt + CHANGELOG) or generic annotations; computes the bump from Conventional Commits; supports prereleases.

### Where the sources do NOT settle it (human must decide)
1. Whether a skill set should be SemVer at all (CalVer/opaque version argued in [#420](https://github.com/agentskills/agentskills/discussions/420)).
2. What counts as MAJOR for a prompt/instruction change that alters behaviour without changing declared inputs/outputs ([#415](https://github.com/agentskills/agentskills/discussions/415)).
3. Whether docs-only edits should release at all ([semver/semver#609](https://github.com/semver/semver/issues/609)).
4. The meaning and ordering of `-dev` ([§9](https://semver.org/#spec-item-9), [§11.4.2](https://semver.org/#spec-item-11)).
5. 0.y.z vs 1.0.0, and the deprecation-before-removal cutoff.
