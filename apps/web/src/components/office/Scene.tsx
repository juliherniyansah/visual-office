'use client';

import { useContext } from 'react';
import {
  AGENT_DEFINITIONS,
  OFFICE_LAYOUT,
  findAgentDesk,
  type AgentId,
  type FloorId,
} from '@redhunter/shared';
import { Lighting } from './Lighting';
import { Building } from './Building';
import { FloorPlane } from './FloorPlane';
import { DeskMarkers } from './DeskMarkers';
import { Agent } from './Agent';
import { CameraRig } from './CameraRig';
import type { AgentStatuses } from './constants';
import { FocusContext } from './focusContext';
import { deskToWorld } from './deskLayout';

export function Scene({ agentStatuses }: { agentStatuses: AgentStatuses }) {
  const { setTarget } = useContext(FocusContext);

  const handleAgentClick = (agentId: AgentId) => {
    const placement = findAgentDesk(agentId);
    if (!placement) return;
    const worldPos = deskToWorld(placement.floorId, placement.deskId);
    setTarget({ position: worldPos, distance: 5 });
  };

  return (
    <>
      <Lighting />

      <Building />

      {OFFICE_LAYOUT.floors.map((floor) => (
        <FloorPlane key={floor.id} floorId={floor.id as FloorId} />
      ))}

      <DeskMarkers />

      {AGENT_DEFINITIONS.map((agent) => (
        <Agent
          key={agent.id}
          agentId={agent.id}
          status={agentStatuses[agent.id]}
          onClick={() => handleAgentClick(agent.id)}
        />
      ))}

      <CameraRig />
    </>
  );
}
