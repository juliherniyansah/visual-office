'use client';

// Daytime phase lighting (plan §4.1 fase siang)
export function Lighting() {
  return (
    <>
      {/* args = [skyColor, groundColor]: R3F has no skyColor prop; constructor args are the canonical form */}
      <hemisphereLight args={['#BFE3F7', '#E3F4FC']} intensity={1.0} />
      <directionalLight
        color="#FFFFFF"
        intensity={1.4}
        position={[12, 22, 8]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-far={60}
      />
    </>
  );
}
