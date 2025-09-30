
import React from 'react';

const FloatingGhosts: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-50px) rotate(10deg); opacity: 0.8; }
          100% { transform: translateY(0) rotate(0deg); opacity: 1; }
        }
        @keyframes drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(100vw); }
        }
        .ghost {
          position: absolute;
          font-size: 3rem;
          animation: float 6s ease-in-out infinite;
          opacity: 0.1;
        }
        .ghost-container {
          position: absolute;
          top: 0;
          left: -100px;
          animation: drift linear infinite;
        }
      `}</style>
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="ghost-container" 
          style={{ 
            top: `${Math.random() * 80}%`,
            animationDuration: `${20 + Math.random() * 20}s`,
            animationDelay: `${Math.random() * 10}s`,
          }}
        >
          <span className="ghost" style={{ animationDelay: `${Math.random() * 5}s` }}>👻</span>
        </div>
      ))}
    </div>
  );
};

export default FloatingGhosts;
