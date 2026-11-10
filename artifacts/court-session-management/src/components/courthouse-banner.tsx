import React from 'react';

export function CourthouseBannerIllustration({ className = 'h-full w-auto' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 380 200"
        className="h-full w-full object-cover"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EBF3FA" />
            <stop offset="70%" stopColor="#DFEAF5" />
            <stop offset="100%" stopColor="#CFDFEE" />
          </linearGradient>

          <linearGradient id="facadeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F5F7FA" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="columnGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="25%" stopColor="#F8FAFC" />
            <stop offset="70%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          <linearGradient id="columnFlute" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#64748B" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#475569" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="pedimentGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8C477" />
            <stop offset="50%" stopColor="#C99732" />
            <stop offset="100%" stopColor="#A87A1E" />
          </linearGradient>

          <linearGradient id="shadowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1E293B" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Soft Background Sky */}
        <rect width="380" height="200" fill="url(#skyGrad)" />

        {/* Distant building wings / background walls */}
        <rect x="20" y="70" width="80" height="130" fill="#CBD5E1" opacity="0.6" />
        <rect x="280" y="70" width="80" height="130" fill="#CBD5E1" opacity="0.6" />

        {/* Windows on background wings */}
        {[35, 60].map((wx) => (
          <g key={wx}>
            <rect x={wx} y="85" width="16" height="26" rx="2" fill="#334155" opacity="0.75" />
            <rect x={wx} y="125" width="16" height="26" rx="2" fill="#334155" opacity="0.75" />
          </g>
        ))}
        {[295, 320].map((wx) => (
          <g key={wx}>
            <rect x={wx} y="85" width="16" height="26" rx="2" fill="#334155" opacity="0.75" />
            <rect x={wx} y="125" width="16" height="26" rx="2" fill="#334155" opacity="0.75" />
          </g>
        ))}

        {/* Main Courthouse Colonnade Back Wall & Dark Recess */}
        <rect x="80" y="55" width="220" height="120" fill="#1E293B" opacity="0.7" />
        <rect x="80" y="55" width="220" height="120" fill="url(#shadowGrad)" />

        {/* Recessed Portico Windows & Center Entrance */}
        <rect x="168" y="100" width="44" height="65" rx="3" fill="#0F172A" />
        <rect x="108" y="90" width="22" height="40" rx="2" fill="#0F172A" opacity="0.8" />
        <rect x="250" y="90" width="22" height="40" rx="2" fill="#0F172A" opacity="0.8" />

        {/* Entablature (Architrave + Frieze + Cornice) */}
        <rect x="65" y="44" width="250" height="12" fill="url(#facadeGrad)" stroke="#94A3B8" strokeWidth="0.8" />
        <rect x="60" y="40" width="260" height="5" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />

        {/* Triangular Pediment (Tympanum) */}
        <polygon
          points="190,4 60,40 320,40"
          fill="url(#facadeGrad)"
          stroke="#94A3B8"
          strokeWidth="1.2"
        />
        <polygon
          points="190,9 75,37 305,37"
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="0.8"
        />

        {/* Pediment Scales of Justice Relief Emblem */}
        <g transform="translate(190, 24) scale(0.18)">
          <polygon points="0,-25 6,-15 -6,-15" fill="url(#pedimentGold)" />
          <rect x="-2" y="-15" width="4" height="35" rx="1.5" fill="url(#pedimentGold)" />
          <rect x="-14" y="20" width="28" height="4" rx="1" fill="url(#pedimentGold)" />
          {/* Beam */}
          <path d="M -30,-4 C -15,-7 15,-7 30,-4" stroke="url(#pedimentGold)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="-6" r="3.5" fill="url(#pedimentGold)" />
          {/* Left Pan */}
          <line x1="-30" y1="-3" x2="-38" y2="12" stroke="url(#pedimentGold)" strokeWidth="1.5" />
          <line x1="-30" y1="-3" x2="-22" y2="12" stroke="url(#pedimentGold)" strokeWidth="1.5" />
          <path d="M -42,12 Q -30,21 -18,12 Z" fill="url(#pedimentGold)" />
          {/* Right Pan */}
          <line x1="30" y1="-3" x2="22" y2="12" stroke="url(#pedimentGold)" strokeWidth="1.5" />
          <line x1="30" y1="-3" x2="38" y2="12" stroke="url(#pedimentGold)" strokeWidth="1.5" />
          <path d="M 18,12 Q 30,21 42,12 Z" fill="url(#pedimentGold)" />
        </g>

        {/* Classical Columns (6 Columns) */}
        {[85, 127, 169, 211, 253, 295].map((colCenter, idx) => (
          <g key={idx}>
            {/* Capital (Top) */}
            <rect x={colCenter - 10} y="54" width="20" height="4" rx="1" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="0.6" />
            <path
              d={`M ${colCenter - 9} 58 C ${colCenter - 8} 61 ${colCenter + 8} 61 ${colCenter + 9} 58 Z`}
              fill="#E2E8F0"
              stroke="#94A3B8"
              strokeWidth="0.5"
            />
            {/* Column Shaft */}
            <rect
              x={colCenter - 8}
              y="59"
              width="16"
              height="104"
              fill="url(#columnGrad)"
              stroke="#94A3B8"
              strokeWidth="0.7"
            />
            {/* Fluting lines */}
            <line x1={colCenter - 4} y1="60" x2={colCenter - 4} y2="162" stroke="url(#columnFlute)" strokeWidth="1.2" />
            <line x1={colCenter} y1="60" x2={colCenter} y2="162" stroke="url(#columnFlute)" strokeWidth="1.5" />
            <line x1={colCenter + 4} y1="60" x2={colCenter + 4} y2="162" stroke="url(#columnFlute)" strokeWidth="1.2" />

            {/* Column Base */}
            <rect x={colCenter - 10} y="163" width="20" height="4" rx="0.5" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.6" />
            <rect x={colCenter - 12} y="167" width="24" height="4" rx="0.5" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.6" />
          </g>
        ))}

        {/* Grand Steps (Plinth & Stylobate) */}
        <polygon points="50,171 330,171 336,177 44,177" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="0.6" />
        <polygon points="44,177 336,177 344,185 36,185" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.6" />
        <polygon points="36,185 344,185 352,193 28,193" fill="#94A3B8" stroke="#64748B" strokeWidth="0.6" />
        <polygon points="28,193 352,193 360,200 20,200" fill="#64748B" stroke="#475569" strokeWidth="0.6" />
      </svg>
    </div>
  );
}
