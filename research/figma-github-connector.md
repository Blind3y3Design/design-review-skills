# What does Figma's GitHub connector let the agent do?

Resolves [#18](https://github.com/Blind3y3Design/design-review-skills/issues/18). Researched 2026-09-30 against primary sources only (Figma Help Center, GitHub Docs, GitHub's `github-mcp-server` repo).

## Answer

Figma documents the GitHub connector in two lines: it can "access public or private GitHub repositories, issues, and pull requests" and "create and summarize GitHub issues and PRs". So **creating an issue** and **opening a pull request** are documented, and **reading private repos** is documented at repository level. **Committing a file to a branch is not documented.** Figma doesn't list the tools, the GitHub scopes, whether it signs in as a GitHub App or an OAuth app, or which GitHub hosts it supports. It does say the server is "from" GitHub. GitHub's own server has tools for all four actions, but Figma doesn't confirm it exposes them. Each user connects with their own GitHub login, and write tools stay off until that user turns them on. For the Cat org, GitHub's rules mean an org owner will likely have to approve or install the app; which one depends on the app type, which only shows on GitHub's consent screen.

## The four actions

| # | Action | Verdict | Source |
|---|---|---|---|
| 1 | Read a file at a repo, branch and path | **Documented as supported** at repository level, for public and private repos. Reading a given branch and path isn't documented. Private **org** repos also depend on the org's GitHub policy (see Cat org access). | [Figma: connectors, GitHub](https://help.figma.com/hc/en-us/articles/35440096186007#h_01KAC61CP6A0QVY74P65S8GPJ0) |
| 2 | Create an issue | **Documented as supported.** It's a write tool, so it's off by default. | [Figma: connectors, GitHub](https://help.figma.com/hc/en-us/articles/35440096186007#h_01KAC61CP6A0QVY74P65S8GPJ0) |
| 3 | Create or update a file on a branch | **Not documented** | [Figma: connectors, GitHub](https://help.figma.com/hc/en-us/articles/35440096186007#h_01KAC61CP6A0QVY74P65S8GPJ0) (no mention) |
| 4 | Open a pull request | **Documented as supported** ("Create ... GitHub issues and PRs"). It's a write tool, so it's off by default. | [Figma: connectors, GitHub](https://help.figma.com/hc/en-us/articles/35440096186007#h_01KAC61CP6A0QVY74P65S8GPJ0) |

## Sources

| Source | Updated | Used for |
|---|---|---|
| [Use verified partner MCP connectors](https://help.figma.com/hc/en-us/articles/35440096186007) | 2026-09-29 | GitHub entry, plans and seats, OAuth, write tools off by default, tool permissions |
| [Manage MCP connectors](https://help.figma.com/hc/en-us/articles/36343926263703) | 2026-09-26 | Admin toggle, "MCP servers from ... GitHub" |
| [Create and use custom MCP connectors](https://help.figma.com/hc/en-us/articles/38147204302743) | 2026-08-18 | Custom connector route, auth methods |
| [Custom skills](https://help.figma.com/hc/en-us/articles/40283639496599) | 2026-09-23 | Skills referencing connectors |
| [AI agent beta access](https://help.figma.com/hc/en-us/articles/34932042346775) | 2026-09-24 | Agent plans, beta limits |
| [Manage the Figma GitHub app](https://help.figma.com/hc/en-us/articles/37516294384919) and [Push from Figma Make to GitHub](https://help.figma.com/hc/en-us/articles/35463818346647) | 2026-08-03, 2026-09-21 | A separate integration (see below) |
| [GitHub MCP server: policies and governance](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/docs/policies-and-governance.md) and [README](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/README.md) | main @ `85598ba` | GitHub's server: tools, scopes, org controls, supported hosts |
| [GitHub: Setting up the GitHub MCP Server](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server) | read 2026-09-30 | Remote server URL, OAuth, GHES and data residency |
| [GitHub: About OAuth app access restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions) | read 2026-09-30 | Org owner approval |
| [GitHub: Installing a GitHub App from a third party](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party) | read 2026-09-30 | Who can install on an org |
| [GitHub: About authentication with SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/about-authentication-with-single-sign-on) | read 2026-09-30 | SAML SSO session rule |

## Tools exposed

- **Figma doesn't name the tools.** Connectors have "multiple MCP tools", split into **read** and **write** in Add context > Connectors > Manage. The list only shows in the product.
- **The server comes from GitHub.** Featured connectors "include MCP servers from Notion, Asana, Linear, GitHub" and are "maintained by Figma's partners" ([36343926263703](https://help.figma.com/hc/en-us/articles/36343926263703)). The endpoint and toolsets Figma uses aren't documented.
- **GitHub's server has a tool for each action** ([README](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/README.md)). Context only; Figma doesn't confirm it exposes them:
  - `get_file_contents` reads a file or directory (OAuth scope `repo`).
  - `issue_write` creates or updates an issue (`repo`).
  - `create_or_update_file` and `push_files` commit to a branch (`repo`, `workflow`); `create_branch` makes one.
  - `create_pull_request` opens a PR (`repo`).
- **Not the Figma GitHub app.** That app powers Make's push to GitHub and Code Connect UI. It pushes only to repos Make creates, only to the default branch, and supports neither GHES nor IP allow lists ([35463818346647](https://help.figma.com/hc/en-us/articles/35463818346647)). No page links it to the connector.

## Setup and permissions

- **Authentication:** "Each person needs to add and authenticate the connectors", "through the external tool's OAuth flow" ([35440096186007](https://help.figma.com/hc/en-us/articles/35440096186007)). GitHub App or OAuth app, and the scopes asked for, are **not documented**.
- **Write tools:** "Tools that can write to external sources are disabled by default. You'll need to manually enable them." Each tool is set to **Ask to run**, **Always run** or **Never run**, in the user's own connector settings. An admin control over single tools is **not documented**.
- **Plan and seat:** connectors are "Available on all plans". Full seats use the agent in any file; View, Dev and Collab seats only in Drafts; edit access is required ([35440096186007](https://help.figma.com/hc/en-us/articles/35440096186007)). No agent on Government or Education plans ([34932042346775](https://help.figma.com/hc/en-us/articles/34932042346775)).
- **Admin control:** on Organization and Enterprise plans, org admins toggle **Allow featured connectors** (Admin > Settings > Connections > MCP connectors in Figma), for the whole org only. Connectors vanish if AI features are off ([36343926263703](https://help.figma.com/hc/en-us/articles/36343926263703)).
- **GitHub hosts:** Figma **doesn't document** GHEC or GHES. GitHub's remote server runs on github.com (including GHEC); data-residency orgs use `copilot-api.<subdomain>.ghe.com/mcp`; "GitHub Enterprise Server does not support remote server hosting" ([README](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/README.md)). A `ghe.com` org would need a **custom connector**, which needs a paid plan and admin permission ([38147204302743](https://help.figma.com/hc/en-us/articles/38147204302743)).

## Cat org access

GitHub documents these rules for any third-party host. Which one applies depends on the app type Figma registered, which isn't documented.

- **If it's an OAuth app:** with OAuth app access restrictions on, members "cannot authorize OAuth app access to organization resources". They can ask for approval, and owners get a notification. The restrictions are "enabled by default" for new orgs ([GitHub](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions)).
- **If it's a GitHub App:** org owners install it and pick its repos. Members who pick the org send the owner an install request. Repo admins can install some apps on repos they admin, unless owners block that ([GitHub](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party)).
- **SAML SSO:** users "must have an active SSO session" when they authorize, or the app "will be unable to access that organization" ([GitHub](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/about-authentication-with-single-sign-on)).
- The "MCP servers in Copilot" policy covers GitHub's own editors, not third-party hosts. Access never exceeds what the user could reach through the API ([governance doc](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/docs/policies-and-governance.md)).

**GitHub org owners:** when someone first connects, approve the OAuth app request or install the GitHub App on the chosen repos. Users connect with an active SSO session.
**Figma admins:** keep AI features and **Allow featured connectors** on; allow custom connectors too if the org is on `ghe.com`. Each user still connects and turns on write tools.

## Use from custom skills

- **Documented:** "Your skills can reference your connectors and you can invoke a skill and reference a connector in the same prompt" ([40283639496599](https://help.figma.com/hc/en-us/articles/40283639496599)). The agent picks the connector and tool "based on your prompt". An `@GitHub` mention limits it to that connector ([35440096186007](https://help.figma.com/hc/en-us/articles/35440096186007)).
- The agent asks before each tool call unless the tool is set to Always run.
- A skill can't turn on write tools or connect for the user. Each user does both themselves.
- **Limits:** Figma documents **no** file-size or rate limits for connectors. The agent has monthly beta usage limits ([34932042346775](https://help.figma.com/hc/en-us/articles/34932042346775)). GitHub's server is "subject to GitHub API rate limits" ([governance doc](https://github.com/github/github-mcp-server/blob/85598ba6e1256f7ebf4867b95d63b833c4549264/docs/policies-and-governance.md)).

## Open questions (for #17's F2, P2, W1, W2)

1. Which tools does the Manage modal list, and which are marked write? Is a file-commit tool there? (W2)
2. Can the read tool take a branch or ref and a path, in a private Cat org repo? (F2, P2)
3. Does GitHub's consent screen show a GitHub App or an OAuth app, which scopes, and does it trigger an org approval or install request?
4. Does issue creation work once write tools are on? (W1) Does opening a PR work, as a fallback for W2?
5. Is Cat's org on github.com or `ghe.com`, and does it use Enterprise Managed Users or an IP allow list? Neither Figma nor GitHub says how these affect this connector.
6. Does a skill's instruction alone make the agent call the connector, or does the prompt need `@GitHub`?
7. Is there a size limit on files read through the connector?
