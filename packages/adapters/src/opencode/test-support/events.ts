// SSE payloads shaped like the live capture of opencode 1.18.35 (.omo/evidence/11/event-names.md).
export const SESSION_ID = 'ses_fixture';
export const OTHER_SESSION_ID = 'ses_other';
const USER_MESSAGE_ID = 'msg_user';
const ASSISTANT_MESSAGE_ID = 'msg_assistant';

export type RawEvent = { readonly type: string; readonly properties: Record<string, unknown> };

export const serverConnected = (): RawEvent => ({ type: 'server.connected', properties: {} });

export function messageUpdated(id: string, role: 'user' | 'assistant', sessionID = SESSION_ID) {
  return { type: 'message.updated', properties: { info: { id, sessionID, role } } };
}

function partUpdated(part: Record<string, unknown>, sessionID = SESSION_ID): RawEvent {
  return {
    type: 'message.part.updated',
    properties: { sessionID, part: { sessionID, messageID: ASSISTANT_MESSAGE_ID, ...part } },
  };
}

export function textPart(id: string, text: string, extra: Record<string, unknown> = {}): RawEvent {
  return partUpdated({ id, type: 'text', text, ...extra });
}

export function textDelta(partID: string, delta: string, field = 'text'): RawEvent {
  return {
    type: 'message.part.delta',
    properties: { sessionID: SESSION_ID, messageID: ASSISTANT_MESSAGE_ID, partID, field, delta },
  };
}

export function toolPart(callID: string, state: Record<string, unknown>, sessionID = SESSION_ID) {
  return partUpdated({ id: `prt_${callID}`, type: 'tool', callID, tool: 'bash', state }, sessionID);
}

export const BASH_INPUT = { command: 'echo hello', description: 'Run echo hello' };

export function stepFinish(id: string, tokens: Record<string, unknown>, cost: unknown = 0.25) {
  return partUpdated({ id, type: 'step-finish', reason: 'stop', cost, tokens });
}

export function patchPart(id: string, files: readonly string[]): RawEvent {
  return partUpdated({ id, type: 'patch', hash: 'abc123', files });
}

export function permissionAsked(id: string, sessionID = SESSION_ID): RawEvent {
  return {
    type: 'permission.asked',
    properties: {
      id,
      sessionID,
      permission: 'bash',
      patterns: ['echo hello'],
      metadata: { command: 'echo hello' },
      always: ['echo *'],
      tool: { messageID: ASSISTANT_MESSAGE_ID, callID: 'call_1' },
    },
  };
}

export function permissionUpdatedV1(id: string, pattern?: string | readonly string[]): RawEvent {
  return {
    type: 'permission.updated',
    properties: {
      id,
      type: 'edit',
      sessionID: SESSION_ID,
      messageID: ASSISTANT_MESSAGE_ID,
      title: 'Edit src/a.ts',
      metadata: {},
      time: { created: 1 },
      ...(pattern === undefined ? {} : { pattern }),
    },
  };
}

export const sessionIdle = (sessionID = SESSION_ID): RawEvent => ({
  type: 'session.idle',
  properties: { sessionID },
});

// `null` = no sessionID key at all (v1 makes it optional).
export function sessionError(error: unknown, sessionID: string | null = SESSION_ID): RawEvent {
  return {
    type: 'session.error',
    properties: sessionID === null ? { error } : { sessionID, error },
  };
}

// A complete happy run: user echo, assistant text via delta, bash tool, patch, usage, idle.
export function happyScript(): RawEvent[] {
  return [
    messageUpdated(USER_MESSAGE_ID, 'user'),
    {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'prt_prompt',
          sessionID: SESSION_ID,
          messageID: USER_MESSAGE_ID,
          type: 'text',
          text: 'PROMPT',
        },
      },
    },
    messageUpdated(ASSISTANT_MESSAGE_ID, 'assistant'),
    toolPart('call_1', { status: 'pending', input: {}, raw: '' }),
    toolPart('call_1', { status: 'running', input: BASH_INPUT, time: { start: 1 } }),
    toolPart('call_1', {
      status: 'completed',
      input: BASH_INPUT,
      output: 'hello\n',
      title: 'echo hello',
      metadata: { output: 'hello\n', exit: 0 },
      time: { start: 1, end: 2 },
    }),
    patchPart('prt_patch', ['src/a.ts']),
    textPart('prt_answer', ''),
    textDelta('prt_answer', 'hel'),
    textDelta('prt_answer', 'lo'),
    textPart('prt_answer', 'hello'),
    stepFinish('prt_step', { input: 120, output: 7, reasoning: 3, cache: { read: 0, write: 0 } }),
    sessionIdle(),
  ];
}
