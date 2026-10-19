import React, { useMemo } from 'react';

// Original sticker-style ghosts: pale body, dark outline, a few different faces.
const FACES = ['dots-o', 'dots-smile', 'wide-o', 'dots-wavy', 'sleepy'] as const;
type Face = (typeof FACES)[number];

const Ghost: React.FC<{ face: Face }> = ({ face }) => {
  const stroke = '#1a0c10';
  return (
    <svg viewBox="0 0 100 110" width="100%" height="100%" aria-hidden="true">
      <path
        d="M50 6 C28 6 14 24 14 46 V88 Q14 99 23 94 L32 87 Q38 101 46 94 Q52 90 55 96 Q61 103 67 94 L77 88 Q86 99 86 88 V46 C86 24 72 6 50 6 Z"
        fill="#f4efe2"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* little arms */}
      <path d="M15 58 Q4 60 6 70 Q10 72 16 68" fill="#f4efe2" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M85 58 Q96 60 94 70 Q90 72 84 68" fill="#f4efe2" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
      {/* eyes */}
      {face === 'wide-o' ? (
        <>
          <ellipse cx="38" cy="46" rx="5" ry="7" fill={stroke} />
          <ellipse cx="62" cy="46" rx="5" ry="7" fill={stroke} />
        </>
      ) : face === 'sleepy' ? (
        <>
          <path d="M31 47 Q38 52 45 47" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M55 47 Q62 52 69 47" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy="46" r="4.5" fill={stroke} />
          <circle cx="62" cy="46" r="4.5" fill={stroke} />
        </>
      )}
      {/* mouth */}
      {face === 'dots-smile' || face === 'sleepy' ? (
        <path d="M42 62 Q50 70 58 62" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      ) : face === 'dots-wavy' ? (
        <path d="M40 64 Q45 59 50 64 Q55 69 60 64" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <ellipse cx="50" cy="64" rx="6" ry="8" fill={stroke} />
      )}
    </svg>
  );
};

interface GhostSpec {
  face: Face;
  size: number;
  top: number;
  duration: number;
  delay: number;
  bobDelay: number;
  reverse: boolean;
}

const FloatingGhosts: React.FC = () => {
  // Randomised once so ghosts don't jump whenever the page re-renders.
  const ghosts = useMemo<GhostSpec[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        face: FACES[i % FACES.length],
        size: 48 + Math.random() * 48,
        top: 4 + Math.random() * 82,
        duration: 28 + Math.random() * 30,
        delay: -Math.random() * 40, // negative: already mid-flight on load
        bobDelay: -Math.random() * 5,
        reverse: i % 2 === 1,
      })),
    []
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes ghost-bob {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-34px) rotate(7deg); }
        }
        @keyframes ghost-drift-right {
          from { transform: translateX(-140px); }
          to { transform: translateX(calc(100vw + 140px)); }
        }
        @keyframes ghost-drift-left {
          from { transform: translateX(calc(100vw + 140px)); }
          to { transform: translateX(-140px); }
        }
        .ghost-lane { position: absolute; left: 0; animation-timing-function: linear; animation-iteration-count: infinite; }
        .ghost-body {
          opacity: 0.32;
          filter: drop-shadow(0 0 10px rgba(217, 180, 90, 0.35));
          animation: ghost-bob 5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ghost-lane, .ghost-body { animation: none; }
          .ghost-lane { transform: translateX(20vw); }
        }
      `}</style>
      {ghosts.map((g, i) => (
        <div
          key={i}
          className="ghost-lane"
          style={{
            top: `${g.top}%`,
            animationName: g.reverse ? 'ghost-drift-left' : 'ghost-drift-right',
            animationDuration: `${g.duration}s`,
            animationDelay: `${g.delay}s`,
          }}
        >
          <div className="ghost-body" style={{ width: g.size, height: g.size * 1.1, animationDelay: `${g.bobDelay}s` }}>
            <Ghost face={g.face} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default FloatingGhosts;
