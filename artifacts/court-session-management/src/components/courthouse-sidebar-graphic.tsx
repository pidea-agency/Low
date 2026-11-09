import React from 'react';
import { THEME_COLORS } from '@/config/theme';

export function ScalesLogoGraphic({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sidebarLogoGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF4DE" />
          <stop offset="30%" stopColor={THEME_COLORS.lightGold} />
          <stop offset="70%" stopColor={THEME_COLORS.primaryGold} />
          <stop offset="100%" stopColor="#A87A1E" />
        </linearGradient>
      </defs>

      {/* Laurel Wreath Left */}
      <path
        d="M 76 135 C 46 132 24 108 24 78 C 24 55 38 35 58 25"
        stroke="url(#sidebarLogoGoldGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M 72 133 C 65 137 57 136 53 130 C 58 128 66 128 72 133 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 58 126 C 50 131 43 127 40 120 C 46 119 53 121 58 126 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 46 116 C 37 120 31 114 30 106 C 36 107 43 110 46 116 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 36 102 C 28 104 22 96 23 88 C 29 90 35 95 36 102 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 29 86 C 21 86 17 78 20 70 C 25 73 29 79 29 86 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 27 68 C 20 66 18 57 23 50 C 27 54 29 61 27 68 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 29 51 C 24 47 25 38 31 32 C 34 37 34 45 29 51 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 37 36 C 33 30 38 23 45 20 C 46 25 43 32 37 36 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 48 25 C 47 18 54 13 61 13 C 60 19 55 24 48 25 Z" fill="url(#sidebarLogoGoldGrad)" />

      {/* Laurel Wreath Right */}
      <path
        d="M 84 135 C 114 132 136 108 136 78 C 136 55 122 35 102 25"
        stroke="url(#sidebarLogoGoldGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M 88 133 C 95 137 103 136 107 130 C 102 128 94 128 88 133 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 102 126 C 110 131 117 127 120 120 C 114 119 107 121 102 126 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 114 116 C 123 120 129 114 130 106 C 124 107 117 110 114 116 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 124 102 C 132 104 138 96 137 88 C 131 90 125 95 124 102 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 131 86 C 139 86 143 78 140 70 C 135 73 131 79 131 86 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 133 68 C 140 66 142 57 137 50 C 133 54 131 61 133 68 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 131 51 C 136 47 135 38 129 32 C 126 37 126 45 131 51 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 123 36 C 127 30 122 23 115 20 C 114 25 117 32 123 36 Z" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 112 25 C 113 18 106 13 99 13 C 100 19 105 24 112 25 Z" fill="url(#sidebarLogoGoldGrad)" />

      {/* Scales */}
      <polygon points="80,24 84,30 80,36 76,30" fill="url(#sidebarLogoGoldGrad)" />
      <rect x="78.5" y="32" width="3" height="74" rx="1.5" fill="url(#sidebarLogoGoldGrad)" />
      <rect x="71" y="104" width="18" height="3" rx="1" fill="url(#sidebarLogoGoldGrad)" />
      <rect x="63" y="110" width="34" height="4" rx="1.5" fill="url(#sidebarLogoGoldGrad)" />
      <path d="M 44 45 C 56 42 70 41 80 41 C 90 41 104 42 116 45" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="80" cy="41" r="4.5" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="2" fill="#0B2A4A" />
      <circle cx="44" cy="45" r="2.5" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.5" fill="#0B2A4A" />
      <line x1="44" y1="47" x2="34" y2="76" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.3" />
      <line x1="44" y1="47" x2="54" y2="76" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.3" />
      <path d="M 30 76 Q 44 88 58 76 Z" fill="url(#sidebarLogoGoldGrad)" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.2" />
      <circle cx="116" cy="45" r="2.5" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.5" fill="#0B2A4A" />
      <line x1="116" y1="47" x2="106" y2="76" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.3" />
      <line x1="116" y1="47" x2="126" y2="76" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.3" />
      <path d="M 102 76 Q 116 88 130 76 Z" fill="url(#sidebarLogoGoldGrad)" stroke="url(#sidebarLogoGoldGrad)" strokeWidth="1.2" />
    </svg>
  );
}

export function CourthouseSidebarGraphic({ className = 'w-full' }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none relative overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 320 220"
        className="w-full h-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sbCourtGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={THEME_COLORS.primaryGold} />
            <stop offset="50%" stopColor={THEME_COLORS.lightGold} />
            <stop offset="100%" stopColor={THEME_COLORS.primaryGold} />
          </linearGradient>

          <linearGradient id="sbPillarShine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B2A4A" stopOpacity="0.4" />
            <stop offset="40%" stopColor={THEME_COLORS.lightGold} stopOpacity="0.8" />
            <stop offset="70%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#071D34" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="sbWaveGold" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#9E731E" />
            <stop offset="30%" stopColor={THEME_COLORS.primaryGold} />
            <stop offset="60%" stopColor={THEME_COLORS.lightGold} />
            <stop offset="85%" stopColor={THEME_COLORS.primaryGold} />
            <stop offset="100%" stopColor="#7E560B" />
          </linearGradient>
        </defs>

        {/* Courthouse Silhouette Pillars */}
        <g opacity="0.35">
          <polygon points="160,20 60,65 260,65" fill="#0B2A4A" stroke="url(#sbCourtGold)" strokeWidth="2" />
          <rect x="55" y="65" width="210" height="8" fill="#0B2A4A" stroke="url(#sbCourtGold)" strokeWidth="1.5" />

          {[80, 112, 144, 176, 208, 240].map((colX, idx) => (
            <g key={idx}>
              <rect
                x={colX - 5}
                y="74"
                width="10"
                height="80"
                fill="url(#sbPillarShine)"
                stroke="url(#sbCourtGold)"
                strokeWidth="0.8"
              />
              <rect x={colX - 7} y="154" width="14" height="4" rx="1" fill="url(#sbCourtGold)" />
            </g>
          ))}
          <polygon points="45,158 275,158 290,175 30,175" fill="#051424" stroke="url(#sbCourtGold)" strokeWidth="0.8" />
        </g>

        {/* Sweeping Golden Wave Ribbon */}
        <path
          d="M 40 220 C 140 160 220 150 320 165 L 320 200 C 230 185 150 200 40 220 Z"
          fill="url(#sbWaveGold)"
        />
        <path
          d="M 40 220 C 140 160 220 150 320 165"
          stroke="#FFF4DE"
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M 80 220 C 180 185 250 180 320 190"
          stroke={THEME_COLORS.lightGold}
          strokeWidth="1.2"
          fill="none"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}
