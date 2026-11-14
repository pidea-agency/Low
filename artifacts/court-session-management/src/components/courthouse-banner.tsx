import React from 'react';
import { THEME_COLORS } from '@/config/theme';

export function CourthouseBannerIllustration({ className = 'h-full w-auto' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 340 180"
        className="h-full w-full object-contain overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Rich Gold Gradient */}
          <linearGradient id="heroGoldPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF7E6" />
            <stop offset="25%" stopColor="#F5D485" />
            <stop offset="60%" stopColor="#C99732" />
            <stop offset="100%" stopColor="#966A16" />
          </linearGradient>

          {/* Soft Gold Light */}
          <linearGradient id="heroGoldSoft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF9EB" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E8C477" stopOpacity="0.4" />
          </linearGradient>

          {/* Architectural Marble / Slate Gradients */}
          <linearGradient id="marbleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#E2E8F0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.6" />
          </linearGradient>

          <linearGradient id="columnShine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.3" />
            <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#E2E8F0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#64748B" stopOpacity="0.4" />
          </linearGradient>

          {/* Ambient Glow */}
          <radialGradient id="heroAmbientGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C99732" stopOpacity="0.22" />
            <stop offset="60%" stopColor="#C99732" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#C99732" stopOpacity="0" />
          </radialGradient>

          {/* Soft Floor Shadow */}
          <radialGradient id="plinthShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0B2A4A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0B2A4A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── 1. Soft Ambient Backlight ── */}
        <circle cx="170" cy="90" r="95" fill="url(#heroAmbientGlow)" />

        {/* ── 2. Classical Courthouse Portico (Background) ── */}
        <g opacity="0.85">
          {/* Triangular Pediment Roof */}
          <polygon
            points="170,22 65,58 275,58"
            fill="url(#marbleGrad)"
            stroke="#94A3B8"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <polygon
            points="170,27 80,55 260,55"
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />

          {/* Roof Entablature & Cornice */}
          <rect x="60" y="58" width="220" height="7" rx="1" fill="url(#marbleGrad)" stroke="#94A3B8" strokeWidth="0.8" />
          <rect x="68" y="65" width="204" height="4" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5" />

          {/* Columns (4 Classical Ionic Columns) */}
          {[88, 142, 198, 252].map((cx, idx) => (
            <g key={idx}>
              {/* Capital */}
              <rect x={cx - 11} y="69" width="22" height="4" rx="1" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
              {/* Shaft */}
              <rect x={cx - 8} y="73" width="16" height="72" rx="1" fill="url(#columnShine)" stroke="#94A3B8" strokeWidth="0.6" />
              {/* Fluting */}
              <line x1={cx - 3} y1="74" x2={cx - 3} y2="144" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.6" />
              <line x1={cx + 3} y1="74" x2={cx + 3} y2="144" stroke="#94A3B8" strokeWidth="0.8" strokeOpacity="0.4" />
              {/* Base */}
              <rect x={cx - 10} y="145" width="20" height="4" rx="0.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5" />
            </g>
          ))}

          {/* Grand Courthouse Steps (Plinth) */}
          <polygon points="54,149 286,149 292,156 48,156" fill="url(#marbleGrad)" stroke="#94A3B8" strokeWidth="0.8" />
          <polygon points="46,156 294,156 302,164 38,164" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.6" />
          <polygon points="36,164 304,164 312,172 28,172" fill="#94A3B8" stroke="#64748B" strokeWidth="0.6" />
        </g>

        {/* Floor Shadow under Steps */}
        <ellipse cx="170" cy="174" rx="145" ry="6" fill="url(#plinthShadow)" />

        {/* ── 3. Prominent Golden Scales of Justice (Foreground Focal Center) ── */}
        <g transform="translate(170, 94)">
          {/* Subtle Golden Glow behind the scale */}
          <circle cx="0" cy="0" r="46" fill="url(#heroAmbientGlow)" opacity="0.7" />

          {/* Laurel Wreath Crown behind Scales */}
          <g opacity="0.85">
            {/* Left Wreath Branch */}
            <path
              d="M -6 38 C -28 32 -42 14 -42 -8 C -42 -24 -28 -38 -12 -44"
              stroke="url(#heroGoldPrimary)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {[-38, -26, -14, -2, 10, 22].map((y, i) => (
              <ellipse
                key={`lw-${i}`}
                cx={-36 + Math.abs(y) * 0.3}
                cy={y}
                rx="4.5"
                ry="2.5"
                transform={`rotate(${i * 12 - 30}, ${-36 + Math.abs(y) * 0.3}, ${y})`}
                fill="url(#heroGoldPrimary)"
              />
            ))}

            {/* Right Wreath Branch */}
            <path
              d="M 6 38 C 28 32 42 14 42 -8 C 42 -24 28 -38 12 -44"
              stroke="url(#heroGoldPrimary)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {[-38, -26, -14, -2, 10, 22].map((y, i) => (
              <ellipse
                key={`rw-${i}`}
                cx={36 - Math.abs(y) * 0.3}
                cy={y}
                rx="4.5"
                ry="2.5"
                transform={`rotate(${-i * 12 + 30}, ${36 - Math.abs(y) * 0.3}, ${y})`}
                fill="url(#heroGoldPrimary)"
              />
            ))}
          </g>

          {/* The Central Pillar & Base */}
          <path d="M 0,-48 L 5,-40 L -5,-40 Z" fill="url(#heroGoldPrimary)" />
          <circle cx="0" cy="-38" r="4.5" fill="url(#heroGoldPrimary)" />
          <rect x="-3" y="-38" width="6" height="76" rx="2" fill="url(#heroGoldPrimary)" />
          <rect x="-18" y="34" width="36" height="5" rx="2" fill="url(#heroGoldPrimary)" />
          <rect x="-22" y="38" width="44" height="4" rx="1.5" fill="url(#heroGoldPrimary)" />

          {/* The Balanced Crossbeam */}
          <path
            d="M -48,-24 C -24,-28 24,-28 48,-24"
            stroke="url(#heroGoldPrimary)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="0" cy="-26" r="5" fill="url(#heroGoldPrimary)" />
          <circle cx="-48" cy="-24" r="3" fill="url(#heroGoldPrimary)" />
          <circle cx="48" cy="-24" r="3" fill="url(#heroGoldPrimary)" />

          {/* Left Pan (Chains & Dish) */}
          <line x1="-48" y1="-22" x2="-60" y2="4" stroke="url(#heroGoldPrimary)" strokeWidth="1.4" strokeDasharray="2,2" />
          <line x1="-48" y1="-22" x2="-36" y2="4" stroke="url(#heroGoldPrimary)" strokeWidth="1.4" strokeDasharray="2,2" />
          <path
            d="M -66,4 C -66,16 -30,16 -30,4 Z"
            fill="url(#heroGoldPrimary)"
            stroke="#966A16"
            strokeWidth="0.8"
          />

          {/* Right Pan (Chains & Dish) */}
          <line x1="48" y1="-22" x2="36" y2="4" stroke="url(#heroGoldPrimary)" strokeWidth="1.4" strokeDasharray="2,2" />
          <line x1="48" y1="-22" x2="60" y2="4" stroke="url(#heroGoldPrimary)" strokeWidth="1.4" strokeDasharray="2,2" />
          <path
            d="M 30,4 C 30,16 66,16 66,4 Z"
            fill="url(#heroGoldPrimary)"
            stroke="#966A16"
            strokeWidth="0.8"
          />
        </g>

        {/* ── 4. Subtle Sparkling Light Accents ── */}
        <g opacity="0.8">
          <path d="M 52,38 L 54,34 L 56,38 L 60,40 L 56,42 L 54,46 L 52,42 L 48,40 Z" fill="#FFF7E6" />
          <path d="M 284,36 L 286,32 L 288,36 L 292,38 L 288,40 L 286,44 L 284,40 L 280,38 Z" fill="#FFF7E6" />
        </g>
      </svg>
    </div>
  );
}
