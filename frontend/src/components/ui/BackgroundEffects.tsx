/**
 * BackgroundEffects component that adds subtle, blurred gradient blobs 
 * to provide depth and a premium SaaS aesthetic.
 */
export const BackgroundEffects = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Top Right Blob */}
      <div 
        className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] animate-pulse" 
        style={{ animationDuration: '8s' }}
      />
      
      {/* Bottom Left Blob */}
      <div 
        className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" 
        style={{ animationDuration: '12s', animationDelay: '2s' }}
      />
      
      {/* Center Subtle Wash */}
      <div className="absolute inset-0 bg-zinc-950 -z-20" />
    </div>
  );
};

export default BackgroundEffects;
