'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

export class WebGLErrorBoundary extends Component<{ children: ReactNode }, WebGLErrorBoundaryState> {
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
