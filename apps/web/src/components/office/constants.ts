import type { AgentId, AgentStatus, FloorId } from '@redhunter/shared';

export const FLOOR_HEIGHT = 4;
export const AGENT_Y_OFFSET = 1.2;
export const CAMERA_LERP_SPEED = 3;

export const FLOOR_COLORS: Record<FloorId, string> = {
  1: '#1e293b',
  2: '#0c4a6e',
  3: '#7c2d12',
  4: '#713f12',
};

export const FLOOR_EMISSIVE: Record<FloorId, string> = {
  1: '#0f172a',
  2: '#082f49',
  3: '#431407',
  4: '#422006',
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#9ca3af',
  thinking: '#3b82f6',
  working: '#22c55e',
  blocked: '#ef4444',
  waiting_permission: '#f59e0b',
  offline: '#374151',
};

export type AgentStatuses = Record<AgentId, AgentStatus>;

export const DEFAULT_STATUSES: AgentStatuses = {
  ceo: 'working',
  cto: 'working',
  coo: 'idle',
  programming: 'working',
  game: 'idle',
  iot: 'offline',
  ai_development: 'working',
};
