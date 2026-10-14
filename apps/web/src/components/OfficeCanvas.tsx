'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Instances, Instance } from '@react-three/drei';
import {
  Suspense,
  useRef,
  useState,
  useMemo,
  useEffect,
  createContext,
  useContext,
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  AGENT_DEFINITIONS,
  OFFICE_LAYOUT,
  findAgentDesk,
  type AgentId,
  type AgentStatus,
  type FloorId,
} from '@redhunter/shared';

const FLOOR_HEIGHT = 4;
const AGENT_Y_OFFSET = 1.2;
const CAMERA_LERP_SPEED = 3;

const FLOOR_COLORS: Record<FloorId, string> = {
  1: '#1e293b',
  2: '#0c4a6e',
  3: '#7c2d12',
  4: '#713f12',
};

const FLOOR_EMISSIVE: Record<FloorId, string> = {
  1: '#0f172a',
  2: '#082f49',
  3: '#431407',
  4: '#422006',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#9ca3af',
  thinking: '#3b82f6',
  working: '#22c55e',
  blocked: '#ef4444',
  waiting_permission: '#f59e0b',
  offline: '#374151',
};

type AgentStatuses = Record<AgentId, AgentStatus>;
type FocusTarget = { position: THREE.Vector3; distance: number } | null;

interface FocusContextValue {
  target: FocusTarget;
  setTarget: (t: FocusTarget) => void;
}

const FocusContext = createContext<FocusContextValue>({
  target: null,
  setTarget: () => {},
});

const DEFAULT_STATUSES: AgentStatuses = {
  ceo: 'working',
  cto: 'working',
  coo: 'idle',
  programming: 'working',
  game: 'idle',
  iot: 'offline',
  ai_development: 'working',
};

function deskPositionForDeskId(deskId: string): { x: number; z: number } {
  const hash = deskId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    x: ((hash % 10) - 5) * 1.5,
    z: ((Math.floor(hash / 10) % 10) - 5) * 1.5,
  };
}

function deskToWorld(floorId: FloorId, deskId: string): THREE.Vector3 {
  const { x, z } = deskPositionForDeskId(deskId);
  return new THREE.Vector3(x, (floorId - 1) * FLOOR_HEIGHT + AGENT_Y_OFFSET, z);
}

function floorCenter(floorId: FloorId): THREE.Vector3 {
  return new THREE.Vector3(0, (floorId - 1) * FLOOR_HEIGHT + 1, 0);
}

function CameraRig() {
  const { target } = useContext(FocusContext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 6, 18));
  const targetLookAt = useRef(new THREE.Vector3(0, 4, 0));

  useEffect(() => {
    if (!target) return;
    const { position, distance } = target;
    targetLookAt.current.copy(position);
    const offset = new THREE.Vector3(distance * 0.6, distance * 0.4, distance * 0.8);
    targetPosition.current.copy(position).add(offset);
  }, [target]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const t = Math.min(1, delta * CAMERA_LERP_SPEED);
    controls.target.lerp(targetLookAt.current, t);
    camera.position.lerp(targetPosition.current, t);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={40}
      maxPolarAngle={Math.PI * 0.48}
    />
  );
}

function Building() {
  const { scene } = useGLTF('/models/building.glb');
  return <primitive object={scene} />;
}

function FloorPlane({ floorId }: { floorId: FloorId }) {
  const y = (floorId - 1) * FLOOR_HEIGHT;
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial
        color={FLOOR_COLORS[floorId]}
        emissive={FLOOR_EMISSIVE[floorId]}
        emissiveIntensity={0.3}
        roughness={0.8}
      />
    </mesh>
  );
}

function DeskMarkers() {
  const desks = useMemo(() => {
    const all: Array<{ position: [number, number, number] }> = [];
    for (const floor of OFFICE_LAYOUT.floors) {
      for (const desk of floor.desks) {
        const { x, z } = deskPositionForDeskId(desk.deskId);
        all.push({
          position: [x, (floor.id - 1) * FLOOR_HEIGHT + 0.4, z],
        });
      }
    }
    return all;
  }, []);

  return (
    <Instances limit={desks.length}>
      <boxGeometry args={[0.8, 0.1, 0.5]} />
      <meshStandardMaterial color="#78716c" roughness={0.6} metalness={0.3} />
      {desks.map((desk, i) => (
        <Instance key={i} position={desk.position} />
      ))}
    </Instances>
  );
}

function Agent({
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

function Scene({ agentStatuses }: { agentStatuses: AgentStatuses }) {
  const { setTarget } = useContext(FocusContext);

  const handleAgentClick = (agentId: AgentId) => {
    const placement = findAgentDesk(agentId);
    if (!placement) return;
    const worldPos = deskToWorld(placement.floorId, placement.deskId);
    setTarget({ position: worldPos, distance: 5 });
  };

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

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

function FloorSelector({
  currentFloor,
  onSelect,
}: {
  currentFloor: FloorId;
  onSelect: (f: FloorId) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
      }}
    >
      {OFFICE_LAYOUT.floors.map((floor) => {
        const fid = floor.id as FloorId;
        const isActive = fid === currentFloor;
        return (
          <button
            key={floor.id}
            onClick={() => onSelect(fid)}
            style={{
              padding: '8px 16px',
              background: isActive ? FLOOR_COLORS[fid] : 'rgba(0,0,0,0.5)',
              color: 'white',
              border: isActive ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'system-ui',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.2s',
              textAlign: 'left' as const,
            }}
          >
            F{floor.id} · {floor.name}
          </button>
        );
      })}
    </div>
  );
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, WebGLErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OfficeCanvas] WebGL error:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#f8fafc',
            fontFamily: 'system-ui',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>WebGL not available</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Your browser or device does not support 3D rendering.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface OfficeCanvasProps {
  agentStatuses?: Partial<AgentStatuses>;
}

export default function OfficeCanvas({ agentStatuses: agentStatusesProp }: OfficeCanvasProps) {
  const [currentFloor, setCurrentFloor] = useState<FloorId>(2);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);

  const agentStatuses = useMemo<AgentStatuses>(
    () => ({
      ...DEFAULT_STATUSES,
      ...agentStatusesProp,
    }),
    [agentStatusesProp],
  );

  const handleFloorSelect = (floorId: FloorId) => {
    setCurrentFloor(floorId);
    setFocusTarget({ position: floorCenter(floorId), distance: 15 });
  };

  return (
    <WebGLErrorBoundary>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <FloorSelector currentFloor={currentFloor} onSelect={handleFloorSelect} />
        <Canvas
          shadows
          camera={{ position: [0, 6, 18], fov: 60, near: 0.1, far: 200 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#0a0a0a');
          }}
        >
          <Suspense fallback={null}>
            <FocusContext.Provider value={{ target: focusTarget, setTarget: setFocusTarget }}>
              <Scene agentStatuses={agentStatuses} />
            </FocusContext.Provider>
          </Suspense>
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
