import { FC } from 'react';

const BackgroundEffects: FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#1a1f35] to-slate-900 opacity-95" />
      
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at center, #A855F7 0.5px, transparent 0.5px)",
          backgroundSize: "20px 20px"
        }}
      />
      
      <div 
        className="absolute -top-1/4 right-0 w-1/2 h-1/2 rounded-full" 
        style={{ 
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
          filter: 'blur(120px)',
          transform: 'translate(30%, 0%)'
        }} 
      />
      <div 
        className="absolute -bottom-1/4 left-0 w-1/2 h-1/2 rounded-full" 
        style={{ 
          background: 'radial-gradient(circle, rgba(96, 165, 250, 0.12) 0%, transparent 70%)',
          filter: 'blur(120px)',
          transform: 'translate(-30%, 0%)'
        }} 
      />
    </div>
  );
};

export { BackgroundEffects };