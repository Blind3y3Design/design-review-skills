# Dovetail tools: Figma connector vs MCP server

Research for issue #4. Question: what can a skill do with Dovetail from Figma's agent (the Dovetail connector) and from an external agent (Dovetail's hosted or local MCP server)?

Researched 2026-09-29 from Dovetail and Figma documentation and the `dovetail/dovetail-mcp` source (commit `88a7389`, 2026-04-20). The Dovetail connector was not authorised in this environment, so no live `tools/list` was run. That means the exact tool schemas on the hosted server are not confirmed.

## Short answer

There are three different Dovetail tool surfaces:

| Surface | Used by | Transport and auth | Tools | Writes? |
| --- | --- | --- | --- | --- |
| **Figma connector** | Figma agent in Figma Design and Figma Make | Hosted endpoint, OAuth through Figma | 9 read tools are documented | Dovetail's scopes allow writes, but Figma turns write tools off by default |
| **Hosted MCP server** `https://dovetail.com/api/mcp` | Claude, ChatGPT, Copilot (first-party); Cursor, Codex, Windsurf and similar (custom) | Streamable HTTP. OAuth 2.1 without DCR or CIMD, or `Authorization: Bearer <API token>` | 50 tools across 5 groups | Yes: create, add, apply, upload, import, comment |
| **Self-hosted MCP server** (`dovetail/dovetail-mcp`) | STDIO-only clients | STDIO, `DOVETAIL_API_TOKEN` env var | 8 tools | No, GET only |

A research-alignment skill that must work everywhere should use only the read tools that all the surfaces share. The self-hosted server has no search and no highlights tool, so a skill that relies on `search_workspace` or `get_project_highlights` will not work there.

## 1. Figma connector (Figma Design and Figma Make)

**Confirmed**

- Dovetail's Figma Make page documents 9 tools: `get_dovetail_projects`, `list_project_insights`, `get_project_insight`, `get_insight_content`, `get_project_highlights`, `list_project_data`, `get_project_data`, `get_data_content`, `search_workspace`. All 9 are read tools. [Dovetail: Figma Make][figma-make]
- To set it up: Add context, then Connectors, then Dovetail, sign in, and "Authorize read-only access". [figma-make]
- The OAuth consent screen asks for more than read access. It also asks for write access ("Create and modify channels…docs…notes and highlights…projects") and offline access through refresh tokens. The page says existing content "will not be modified unless you explicitly instruct Figma Make to create or update content". [figma-make]
- Figma's side: connectors work in the Figma agent in "Figma Design and Figma Make files". Full seats can use them. View, Dev and Collab seats can use them only in Drafts. Edit access to the file is required. [Figma Help: connectors][figma-help]
- "Tools that can write to external sources are disabled by default. You'll need to manually enable them." [figma-help]
- An org admin can disable Connectors ("If Connectors isn't an option in the menu, an admin may have disabled this feature"). Custom MCP connectors require a paid plan. The featured Dovetail connector does not. [figma-help]
- Access follows the user's own Dovetail permissions. Each Dovetail login method (Google, SSO, email and password) is a separate identity, so a workspace only appears if the user signs in to Dovetail the same way they sign in to Figma. [figma-make]
- Dovetail announced the connector on 2026-02-20 as a Figma Make connector. [Dovetail changelog][figma-changelog]

**Uncertain**

- **Whether Figma really sees only those 9 tools.** Dovetail's MCP docs say Figma uses the hosted server as a "first-party integration" [mcp-docs], and that server now has 50 tools. The 9 documented names use the old "insight" naming. Insights were renamed to Docs on 2026-06-03 [docs-ga], and the hosted list now has `list_docs`, `get_doc` and `get_doc_content` in their place. So the Figma Make page may be out of date. Figma may expose the full hosted set, with write tools off, or it may expose a filtered subset. Only a `tools/list` from inside Figma can settle this.
- Nothing documents a Dovetail-side admin switch that turns off MCP or connectors for a workspace. Dovetail's MCP help page describes control at the user level only. [Dovetail: MCP server help][mcp-help]

## 2. Hosted MCP server (external agents)

**Confirmed** [Dovetail developer docs: MCP][mcp-docs]

- Endpoint `https://dovetail.com/api/mcp`, Streamable HTTP (MCP spec 2025-03-26).
- Auth: OAuth 2.1 in the browser, found through `/.well-known/oauth-protected-resource/api/mcp`. The docs say there is **no DCR or CIMD** and no public `clientId`, so a custom client that needs DCR must use an API token as a Bearer header instead.
- An unauthenticated probe on 2026-09-29 returned `401` with `WWW-Authenticate: Bearer realm="dovetail-mcp"`. The metadata lists `authorization_servers: ["https://auth.dovetail.com"]` and the scopes include `search:read`, `project:read`, `note:read`, `insight:read`, `file:read`, `user:read`, the matching `:write` and `:delete` scopes, and `offline_access`.
- API tokens: users create them in their own account settings. Each token is prefixed `api.` and **expires after 30 days**. [Authorization][auth] The documentation mentions no admin approval step.
- Rate limit: 200 REST requests per minute **per workspace**, shared across all tokens. [Rate limits][rate] (That the MCP server is subject to this limit is an inference, because the server calls the REST API.)

Tool list [mcp-docs]. "R" means read and "W" means write, judged from the tool's name and description.

| Group | Read | Write |
| --- | --- | --- |
| Workspace, project, folder | `search_workspace`, `get_dovetail_projects`, `get_project`, `get_project_context`, `get_workspace_context`, `list_project_templates`, `list_folders`, `get_folder`, `get_folder_contents` | `create_project`, `add_project_context_keywords`, `add_project_context_doc`, `add_workspace_context_doc`, `create_folder` |
| Data, docs, highlights | `list_project_data`, `get_project_data`, `get_data_content` (markdown), `get_project_highlights`, `get_highlight`, `list_docs`, `get_doc`, `get_doc_content` (markdown), `list_doc_comments`, `get_doc_comment` | `create_data`, `create_transcript_highlight`, `create_doc`, `create_comment` |
| Channels | `list_channels`, `get_channel`, `list_channel_data`, `get_channel_datum`, `list_channel_themes` | `create_channel_datum` |
| People | `list_users`, `get_user`, `list_contacts`, `get_contact` | none |
| Tags, fields, files | `list_tags`, `get_tag`, `list_fields`, `get_field`, `get_file`, `download_file` (presigned URL) | `create_tag`, `apply_tags`, `upload_file`, `complete_file_upload`, `import_file_to_data`, `import_file_to_doc` |

The docs list no update or delete tools, so a skill cannot use MCP to destroy data. `create_comment` could, however, post a comment on a research doc, for example to flag a design that contradicts it.

**Uncertain**

- The **input schema of `search_workspace` is not published.** The public REST API has two search endpoints:
  - `POST /v1/search` ("Magic Search"): "full-text search", with `query` described as "keyword search". It filters by entity type and attributes. Default limit 50, maximum 250. [v1 search][v1]
  - `POST /v2/search` (recommended): `query` is "full-text search string matched against titles and content", with a maximum of 512 characters. It filters by `types` (HIGHLIGHT, NOTE, INSIGHT, PROJECT, TAG, THEME, PERSON, CHANNEL and others), `location` (project or folder IDs), `user`, `tags` and `themes` (IDs), `people`, `fields`, and `date` (presets such as `last90Days`, or a custom from/to range). It sorts by RELEVANCE, CREATED or UPDATED. Default limit 20, maximum 100. [v2 search][v2]
  - Which endpoint `search_workspace` calls, and which of these filters it exposes, is unconfirmed. No Dovetail source calls either endpoint semantic or vector search. Treat search as **keyword or full-text**, and do not assume project, tag or date filters are available in the tool until they are checked.
- Parameter schemas for the other hosted tools are not documented. The REST equivalents suggest what they probably accept (see the next section).

## 3. Self-hosted MCP server (`dovetail/dovetail-mcp`)

**Confirmed from source** (`src/index.ts`, v0.2.0) [repo][repo]

- STDIO only. Needs Node 22 or later and `DOVETAIL_API_TOKEN`. Every call is a `GET` to `https://dovetail.com/api/v1/...` with 3 retries on network errors or 5xx responses. Output is raw JSON, formatted with `JSON.stringify`.
- 8 tools, all read-only:
  - `get_dovetail_projects` (filter `title.contains` or `title.equal_to`, sort, cursor pagination with a limit up to 100)
  - `list_project_insights` (filter `project_id` (one or many), `published`, `title`, sort, pagination)
  - `get_project_insight`, which calls `/insights/{id}`
  - `get_insight_content`, which calls `/insights/{id}/export/markdown`
  - `list_personal_project_insights`, which calls `/insights/user/{user_id}`
  - `list_project_data` (filter `project_id`, `title`, `created_at` gt/gte/lt/lte, sort, pagination)
  - `get_project_data`, which calls `/data/{id}`
  - `get_data_content`, which calls `/data/{id}/export/markdown`
- **There is no `search_workspace` and no highlights tool.**
- Bug: `list_project_insights` and `list_personal_project_insights` accept a `created_at` filter in their schema, but never add it to the request, so date filtering on insights does nothing.
- The server calls `/insights` endpoints, which the REST reference now marks as deprecated in favour of `/docs`. [llms.txt][llms]

## 4. What comes back

From the REST reference, which the MCP tools wrap:

- **Highlights**: "selected passages of text (or time ranges in audio/video transcripts) within data entries". Fields include `text`, `note_id`, `tags`, `start_time` and `end_time`, and `url`. The list can be filtered by only one of `project_id`, `tag_id` or `highlight_id` at a time, plus `created_at` and `updated_at`. [List highlights][hl] This is the closest thing to a **quote**.
- **Data (notes)**: raw research such as interview transcripts, survey responses and tickets. `get_*_data` returns metadata only. The body, including the **full transcript**, comes from `get_data_content` as markdown. [llms]
- **Docs (formerly insights)**: synthesised research reports, returned as markdown by `get_doc_content` or `get_insight_content`. [llms]
- **Search results** (v2): one array per type. Highlights come back with `id`, `url` (a link to the parent note, marked experimental), `preview_text`, `project_id`, `project_title`, `tags`, and timestamps. There is also a top-level `url` that opens the search in Dovetail's Explore page. [v2]
- **Links**: resources carry `url` fields that link to the Dovetail web app. Dovetail marks these as "experimental and may change without notice". [v2]
- IDs are 22-character Base62 UUIDs and can be reused across endpoints. [Introduction][intro]

## Implications for the research-alignment skill

1. **Tools to rely on everywhere**: `get_dovetail_projects`, `list_project_data`, `get_data_content`. Also `list_project_insights`, `get_project_insight` and `get_insight_content` on Figma and the self-hosted server, or `list_docs`, `get_doc` and `get_doc_content` on the hosted server. The skill should list its tools at startup and accept either naming.
2. **Use search and highlights when they are there**: `search_workspace` and `get_project_highlights` exist on Figma and the hosted server, but not on the self-hosted server. Without them, the skill has to fall back to listing a project's data and docs and reading the markdown.
3. **Stay read-only.** Figma turns write tools off by default, and the self-hosted server has none. Do not rely on `create_comment` or `apply_tags`.
4. **Search**: write keyword queries, not natural-language questions. Scope to a project by passing IDs, not names. Treat any filter support as optional.
5. **Auth notes for the skill's setup section**:
   - In Figma, the user needs a Full seat (or must work in Drafts), and the org must not have disabled connectors.
   - They must sign in to Dovetail with the same login method they use for Figma.
   - External agents that need DCR must use a 30-day API token.
   - The rate limit is 200 requests per minute, shared across the whole workspace.

## Open items to check with a live connection

- Run `tools/list` from inside Figma and against the hosted endpoint, to confirm the tool names, whether `search_workspace` has filter parameters, and whether search is semantic.
- Confirm whether Figma exposes the hosted write tools as toggles.

## Sources

[figma-make]: https://docs.dovetail.com/integrations/figma-make
[figma-help]: https://help.figma.com/hc/en-us/articles/35440096186007-Connect-external-tools-using-Figma-Make-connectors
[figma-changelog]: https://dovetail.com/changelog/dovetail-connector-figma-make
[mcp-docs]: https://developers.dovetail.com/docs/mcp
[mcp-help]: https://docs.dovetail.com/integrations/mcp-server
[docs-ga]: https://dovetail.com/changelog/docs-general-availability/
[auth]: https://developers.dovetail.com/docs/authorization
[rate]: https://developers.dovetail.com/docs/rate-limits
[v1]: https://developers.dovetail.com/reference/post_v1-search
[v2]: https://developers.dovetail.com/reference/post_v2-search
[hl]: https://developers.dovetail.com/reference/get_v1-highlights
[llms]: https://developers.dovetail.com/llms.txt
[intro]: https://developers.dovetail.com/docs/introduction
[repo]: https://github.com/dovetail/dovetail-mcp/blob/88a7389ccca718f9eff2f680ecb3f34713500866/src/index.ts

- Dovetail: Figma Make integration: <https://docs.dovetail.com/integrations/figma-make>
- Figma Help: Connect external tools using connectors: <https://help.figma.com/hc/en-us/articles/35440096186007-Connect-external-tools-using-Figma-Make-connectors>
- Dovetail changelog: Figma Make connector (2026-02-20): <https://dovetail.com/changelog/dovetail-connector-figma-make>
- Dovetail developer docs: MCP server (updated 2026-09-24): <https://developers.dovetail.com/docs/mcp>
- Dovetail developer docs: Self-hosted MCP: <https://developers.dovetail.com/docs/mcp-self-hosted>
- Dovetail help: MCP server: <https://docs.dovetail.com/integrations/mcp-server>
- Dovetail changelog: Docs GA (Insights renamed, 2026-06-03): <https://dovetail.com/changelog/docs-general-availability/>
- Dovetail API: Authorization, Rate limits, Introduction, Search v1, Search v2, List highlights, and `llms.txt` index (links above)
- `dovetail/dovetail-mcp` source at `88a7389`: <https://github.com/dovetail/dovetail-mcp>
- Hosted endpoint probe: `POST https://dovetail.com/api/mcp` (401) and `GET https://dovetail.com/.well-known/oauth-protected-resource/api/mcp`, both run 2026-09-29
