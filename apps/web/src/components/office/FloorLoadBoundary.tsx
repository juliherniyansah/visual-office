'use client';

import { Component, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';

const MODEL_LOAD_PATTERN = /Could not load|\.glb|Failed to fetch|NetworkError|net::/i;

export function isModelLoadError(error: Error): boolean {
  return MODEL_LOAD_PATTERN.test(error.message);
}

interface FloorLoadBoundaryProps {
  children: ReactNode;
  // Changes when the user picks another floor; clears a previous load failure.
  resetKey: number;
  // GLB url of the current floor, evicted from the drei cache so a retry refetches it.
  modelUrl: string;
}

interface FloorLoadBoundaryState {
  error: Error | null;
}

// Wraps only <Canvas>: a failed GLB fetch must not take the floor selector down.
// Non model errors are rethrown so the outer WebGLErrorBoundary still handles them.
export class FloorLoadBoundary extends Component<FloorLoadBoundaryProps, FloorLoadBoundaryState> {
  constructor(props: FloorLoadBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): FloorLoadBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    if (!isModelLoadError(error)) return;
    console.error('[FloorLoadBoundary] floor model failed to load:', error);
  }

  override componentDidUpdate(prevProps: FloorLoadBoundaryProps) {
    if (prevProps.resetKey === this.props.resetKey || !this.state.error) return;
    this.reset(prevProps.modelUrl);
  }

  private reset(failedUrl: string) {
    // A rejected promise stays cached by drei; without clearing, retrying rethrows it.
    // Extract URL from drei's error message format: "Could not load <url>: ..."
    const error = this.state.error;
    if (error?.message) {
      const match = error.message.match(/Could not load\s+([^:]+):/);
      if (match?.[1]) {
        useGLTF.clear(match[1]);
      }
    }
    // Always clear floor URL as fallback; also clear shell and char in case they
    // were the true source of the error (e.g., models preloaded in ModelPreloader).
    useGLTF.clear(failedUrl);
    useGLTF.clear('/models/hq_shell.glb');
    useGLTF.clear('/models/char_base.glb');
    this.setState({ error: null });
  }

  private handleRetry = () => {
    this.reset(this.props.modelUrl);
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (!isModelLoadError(error)) throw error;

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
        <div style={{ fontSize: 18, fontWeight: 600 }}>Gagal memuat model lantai</div>
        <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 480, textAlign: 'center' }}>
          {error.message}
        </div>
        <button
          type="button"
          onClick={this.handleRetry}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'system-ui',
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  }
}
