import React from 'react';

export const Background: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      {/* Texture Layer */}
      <div 
        className="w-full h-full bg-cover bg-center bg-no-repeat opacity-[0.15] contrast-[1.5] mix-blend-luminosity pattern-grid" 
        style={{
          backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAI4zN8_qRi1o-254JPBlQ_wvCqzAbPHFKtvD5BTx7RAQhv1odu0vCfhI-hUKf0jh5TdTPUJ9iovx9cNmEeU-MSX5xHH17Sggd-jbLLYuPyk8_jtZii_EN95xPChDdNy5MRaUOdc5VG7OgBo41LaufnVNV0T_mXa4VQDMwopSOmjaxy0G9S9JOB75LZ25BuYzMKzHk7ms3MkBA7MBn6Mm5lw5ey45RBd8YZonrOWhCmGLHKDytfTfMOj25nwHHyb39KWQo2tW00FfBp")'
        }}
      />
      
      {/* Gradient Overlay - theme aware */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
    </div>
  );
};