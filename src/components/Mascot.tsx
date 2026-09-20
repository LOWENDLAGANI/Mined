// Mined — Mascot component. Shows public/assets/mascot.png if present,
// otherwise a friendly placeholder emoji.
import { useState } from 'react';
import { MASCOT_SOURCES } from '../assets/brand';

export function Mascot({ size = 96 }: { size?: number }) {
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed || srcIdx >= MASCOT_SOURCES.length) {
    return <div style={{ fontSize: size * 0.7, lineHeight: 1 }} aria-hidden="true">🎓</div>;
  }
  return (
    <img
      src={MASCOT_SOURCES[srcIdx]}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      onError={() => {
        if (srcIdx + 1 < MASCOT_SOURCES.length) setSrcIdx(srcIdx + 1);
        else setFailed(true);
      }}
    />
  );
}
