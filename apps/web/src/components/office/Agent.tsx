'use client';

import { Html } from '@react-three/drei';
import { AGENT_DEFINITIONS, findAgentDesk, type AgentId, type AgentStatus } from '@redhunter/shared';
import { deskToWorld } from './deskLayout';
import { STATUS_COLORS } from './constants';

export function Agent({
  agentId,
  status,
  onClick,
}: {
  agentId: AgentId;
  status: AgentStatus;
  onClick: () => void;
}) {
  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId);
  const placement = findAgentDesk(agentId);
  if (!agent || !placement) return null;

  const worldPos = deskToWorld(placement.floorId, placement.deskId);
  const color = STATUS_COLORS[status];

  return (
    <group position={worldPos}>
      <mesh
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <capsuleGeometry args={[0.25, 0.8, 4, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={status === 'working' ? 0.4 : 0.1}
          roughness={0.5}
        />
      </mesh>
      <Html position={[0, 1, 0]} center distanceFactor={10}>
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'system-ui',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {agent.title}
        </div>
      </Html>
    </group>
  );
}
