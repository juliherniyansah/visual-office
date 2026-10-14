'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { Suspense, useEffect, useRef, useState, Component, type ReactNode, type ErrorInfo } from 'react';
import * as THREE from 'three';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WebGL rendering error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function Building() {
  const { scene } = useGLTF('/models/building.glb');
  return <primitive object={scene} position={[0, 0, 0]} />;
}

function Character({ animationName = 'idle' }: { animationName?: string }) {
  const { scene, animations } = useGLTF('/models/character.glb');
  const { actions, mixer } = useAnimations(animations, scene);
  const [currentAction, setCurrentAction] = useState<string>(animationName);

  useEffect(() => {
    if (actions[currentAction]) {
      actions[currentAction].reset().fadeIn(0.5).play();
      return () => {
        if (actions[currentAction]) {
          actions[currentAction].fadeOut(0.5);
        }
      };
    }
  }, [currentAction, actions]);

  useEffect(() => {
    setCurrentAction(animationName);
  }, [animationName]);

  return <primitive object={scene} position={[2, 0, 2]} />;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#88ccff" />

      <Suspense fallback={null}>
        <Building />
        <Character animationName="idle" />
      </Suspense>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
}

function WebGLFallback() {
  return (
    <div style={{
      width: '100%',
      height: '600px',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏢</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        3D Office View
      </h2>
      <p style={{ fontSize: '1rem', opacity: 0.8, maxWidth: '500px' }}>
        WebGL is not available in your browser. The 3D office visualization requires hardware acceleration.
        Please try a different browser or enable hardware acceleration in your browser settings.
      </p>
    </div>
  );
}

export function OfficeCanvas() {
  return (
    <WebGLErrorBoundary fallback={<WebGLFallback />}>
      <div style={{ width: '100%', height: '600px', background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%)' }}>
        <Canvas
          camera={{ position: [8, 5, 8], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextcreationerror', ((event: WebGLContextEvent) => {
              console.error('WebGL context creation error:', event.statusMessage);
            }) as EventListener);
          }}
        >
          <color attach="background" args={['#0a0a1a']} />
          <fog attach="fog" args={['#0a0a1a', 20, 50]} />
          <Scene />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
