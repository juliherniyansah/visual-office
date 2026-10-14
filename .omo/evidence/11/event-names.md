# T11 OpenCode SDK shapes (verified)

SDK: `/home/programer/.opencode/node_modules/@opencode-ai/sdk` v1.18.13 (pinned dep).
Server binary: `/home/programer/.bun/bin/opencode` v1.18.35.
Abbrev: `T1` = `dist/gen/types.gen.d.ts` (v1), `T2` = `dist/v2/gen/types.gen.d.ts`, `S1` = `dist/gen/sdk.gen.d.ts`.

## Live capture (2026-10-10, /tmp/opencode/t11probe/events.jsonl, real `opencode serve` 1.18.35)

Raw SSE `GET /event`, one prompt "run `echo hello` with bash", bash permission `ask`:

| event type (as emitted) | count |
|---|---|
| server.connected | 1 |
| session.created / session.updated | 1 / 6 |
| message.updated | 14 |
| message.part.updated (part.type text / step-start / tool / step-finish) | 4 / 3 / 8 / 3 |
| message.part.delta (field text) | 1 |
| permission.asked | 1 |
| permission.replied | 1 |
| session.status | 8 |
| session.diff | 3 |
| session.idle | 1 |
| noise: tui.toast.show, plugin.added, catalog.updated, reference.updated, integration.updated, server.heartbeat | - |

KEY FINDING: server 1.18.35 emits the **v2 names** `permission.asked` (not v1 `permission.updated`) and
`message.part.delta` (v1 `message.part.updated` has no `delta` here). The mapper accepts BOTH v1 and v2 shapes.

## Events relied on

| type | shape | source |
|---|---|---|
| `message.part.updated` | `properties: {part: Part, delta?: string}` (v2 adds `sessionID`, `time`) | T1 L354-360; T2 L616-623 |
| `message.part.delta` | `properties: {sessionID, messageID, partID, field, delta}` | T2 L972-981 |
| `permission.updated` (v1) | `properties: Permission` | T1 L384-387 |
| `permission.asked` (v2, live) | `properties: {id, sessionID, permission, patterns[], metadata, always[], tool?:{messageID, callID}}` | T2 L1126-1142 |
| `permission.replied` | v1 `{sessionID, permissionID, response}`; v2 `{sessionID, requestID, reply}` | T1 L388-395; T2 L1143-1150 |
| `session.status` | `{sessionID, status: SessionStatus}` | T1 L406-412 |
| `session.idle` | `{sessionID}` | T1 L413-418; T2 L1223-1228 |
| `session.error` | `{sessionID?, error?: ProviderAuthError/UnknownError/MessageOutputLengthError/MessageAbortedError/ApiError}`, each `{name, data:{message?...}}` | T1 L518-524, L61-97 |
| `server.connected` | `{}` | T1 L596-601 |

`SessionStatus` = `{type:'idle'} | {type:'retry', attempt, message, next} | {type:'busy'}` (T1 L396-405). Not mapped (session.idle is the terminal signal).

## Parts relied on

| Part | fields used | source |
|---|---|---|
| TextPart | `id, sessionID, messageID, type:'text', text, synthetic?, ignored?` | T1 L142-157 |
| ReasoningPart | `type:'reasoning', text` (ignored by mapper: not user-facing output) | T1 L158-171 |
| ToolPart | `callID, tool, state: ToolState` | T1 L263-274 |
| ToolState | pending `{input, raw}`; running `{input, title?, time.start}`; completed `{input, output, title, metadata, time}`; error `{input, error}` | T1 L211-262 |
| StepFinishPart | `type:'step-finish', reason, cost, tokens:{input, output, reasoning, cache:{read, write}}` | T1 L282-299 |
| PatchPart | `type:'patch', hash, files: string[]` | T1 L307-314 |
| FilePart | `type:'file', mime, filename?, url` (attachment, not a workspace change: ignored) | T1 L201-210 |
| Permission (v1) | `id, type, pattern?: string \| string[], sessionID, messageID, callID?, title, metadata, time` | T1 L369-383 |

Live: bash ToolState.completed `metadata.exit` (number) = exit code (`{"output":"hello\n","exit":0}`); used for `tool.exitCode` when integer.
Live: user prompt is echoed as a TextPart on the user message; mapper keeps text only from assistant messages
(tracks `message.updated` role) so the prompt never leaks into `text`/`finalText`. Text parts with `ignored: true` or `synthetic: true` skipped.

## Requests relied on

| call | data | source |
|---|---|---|
| `client.session.create({body:{title?}})` | `POST /session`, 200 `Session` (`id`) | S1 L114; T1 L1811-1834, Session L465 |
| `client.session.promptAsync({path:{id}, body:{agent?, parts:[{type:'text', text}]}})` | `POST /session/{id}/prompt_async`, 204 | S1 L182; T1 L2329-2372, TextPartInput L1231 |
| `client.session.abort({path:{id}})` | `POST /session/{id}/abort`, 200 boolean | S1 L150; T1 L2059-2085 |
| `client.postSessionIdPermissionsPermissionId({path:{id, permissionID}, body:{response:'once'\|'always'\|'reject'}})` | `POST /session/{id}/permissions/{permissionID}`, 200 boolean | S1 L381; T1 L2510-2539 |
| `client.event.subscribe({signal, sseMaxRetryAttempts, onSseError})` | `GET /event` SSE, `{stream: AsyncGenerator<Event>}` | S1 L375; T1 L3366-3380; `dist/gen/core/serverSentEvents.gen.d.ts` |
| health | `GET /global/health` -> `{healthy: true, version: string}` (v2 only: T2 L6203-6225; v1 client has no health method) | live: `{"healthy":true,"version":"1.18.35"}` |

Decision: answer mapping `allow -> 'once'`, `deny -> 'reject'` (never `always`: each grant stays per-call).

## Config relied on

`Config.agent: {[name]: AgentConfig}` (T1 L1112-1118); `AgentConfig.permission: {edit?, bash?: action | {[glob]: action}, webfetch?, doom_loop?, external_directory?}` with action `'ask'|'allow'|'deny'` (T1 L857-865).
Passed to server via env `OPENCODE_CONFIG_CONTENT` (JSON), same as SDK `createOpencodeServer` (`dist/server.js` L15).
Note: `task` key from plan §8 is NOT in the v1 AgentConfig.permission type; not set.

## Discrepancies

1. Plan §8 / T11 card says `/api/session/...`, `/api/event`. SDK v1 routes have no `/api` prefix: `/session/{id}/permissions/{permissionID}`, `/event`. Live server confirms (`POST /session/<id>/permissions/perm_x` -> 404 `PermissionNotFoundError`, i.e. route exists). Adapter uses SDK client methods, never hand-built URLs.
2. SDK `createOpencodeServer` spawns `opencode` with `{...process.env, OPENCODE_CONFIG_CONTENT}` (`dist/server.js` L13-16), i.e. inherits full env. Violates plan §13 env allow-list, so the adapter spawns `opencode serve` itself via T8 `spawnChild` (allow-list env + `opts.env`, forbidden names stripped) and parses the same `opencode server listening on <url>` line (`dist/server.js` L33).
3. SDK SSE client retries forever with backoff by default (`serverSentEvents.gen.js`, `sseMaxRetryAttempts` undefined) and swallows errors into `onSseError`. Adapter sets `sseMaxRetryAttempts: 1` + captures `onSseError` so an unreachable server yields `failed`.
4. v1 types describe `permission.updated`; live 1.18.35 emits `permission.asked` (v2). Both mapped.
