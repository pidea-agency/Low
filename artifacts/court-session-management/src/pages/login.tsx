import React, { useState } from 'react';
import { useLogin } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { User, Lock, Eye, EyeOff, Users, LogIn, AlertCircle } from 'lucide-react';
import { THEME_COLORS } from '@/config/theme';

/* ─────────────────────────────────────────────────────────────
   SVG: Golden Scales of Justice with Classical Laurel Wreath
   Uses exact palette: #C99732 (Primary Gold) & #E8C477 (Light Gold)
   ───────────────────────────────────────────────────────────── */
function LaurelScalesEmblem({ className = 'w-28 h-28' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="goldEmblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF4DE" />
          <stop offset="25%" stopColor={THEME_COLORS.lightGold} />
          <stop offset="60%" stopColor={THEME_COLORS.primaryGold} />
          <stop offset="100%" stopColor="#A87A1E" />
        </linearGradient>
        <linearGradient id="goldPlateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF4DE" />
          <stop offset="50%" stopColor={THEME_COLORS.lightGold} />
          <stop offset="100%" stopColor={THEME_COLORS.primaryGold} />
        </linearGradient>
        <filter id="emblemGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={THEME_COLORS.primaryGold} floodOpacity="0.4" />
        </filter>
      </defs>

      <g filter="url(#emblemGlow)">
        {/* ── Laurel Wreath (Left Branch) ── */}
        <path
          d="M 76 135 C 46 132 24 108 24 78 C 24 55 38 35 58 25"
          stroke="url(#goldEmblemGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Left Leaves */}
        <path d="M 72 133 C 65 137 57 136 53 130 C 58 128 66 128 72 133 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 58 126 C 50 131 43 127 40 120 C 46 119 53 121 58 126 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 46 116 C 37 120 31 114 30 106 C 36 107 43 110 46 116 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 36 102 C 28 104 22 96 23 88 C 29 90 35 95 36 102 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 29 86 C 21 86 17 78 20 70 C 25 73 29 79 29 86 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 27 68 C 20 66 18 57 23 50 C 27 54 29 61 27 68 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 29 51 C 24 47 25 38 31 32 C 34 37 34 45 29 51 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 37 36 C 33 30 38 23 45 20 C 46 25 43 32 37 36 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 48 25 C 47 18 54 13 61 13 C 60 19 55 24 48 25 Z" fill="url(#goldEmblemGrad)" />

        {/* ── Laurel Wreath (Right Branch) ── */}
        <path
          d="M 84 135 C 114 132 136 108 136 78 C 136 55 122 35 102 25"
          stroke="url(#goldEmblemGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Right Leaves */}
        <path d="M 88 133 C 95 137 103 136 107 130 C 102 128 94 128 88 133 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 102 126 C 110 131 117 127 120 120 C 114 119 107 121 102 126 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 114 116 C 123 120 129 114 130 106 C 124 107 117 110 114 116 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 124 102 C 132 104 138 96 137 88 C 131 90 125 95 124 102 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 131 86 C 139 86 143 78 140 70 C 135 73 131 79 131 86 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 133 68 C 140 66 142 57 137 50 C 133 54 131 61 133 68 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 131 51 C 136 47 135 38 129 32 C 126 37 126 45 131 51 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 123 36 C 127 30 122 23 115 20 C 114 25 117 32 123 36 Z" fill="url(#goldEmblemGrad)" />
        <path d="M 112 25 C 113 18 106 13 99 13 C 100 19 105 24 112 25 Z" fill="url(#goldEmblemGrad)" />

        {/* Bottom Ribbon Knot */}
        <circle cx="80" cy="136" r="3.5" fill="url(#goldEmblemGrad)" />
        <path d="M 76 137 C 72 142 67 146 64 148" stroke="url(#goldEmblemGrad)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 84 137 C 88 142 93 146 96 148" stroke="url(#goldEmblemGrad)" strokeWidth="1.8" strokeLinecap="round" />

        {/* ── Center Scales of Justice ── */}
        {/* Top Diamond Finial */}
        <polygon points="80,24 84,30 80,36 76,30" fill="url(#goldEmblemGrad)" />

        {/* Main Central Vertical Pillar */}
        <rect x="78.5" y="32" width="3" height="74" rx="1.5" fill="url(#goldEmblemGrad)" />

        {/* Pedestal Base */}
        <rect x="71" y="104" width="18" height="3" rx="1" fill="url(#goldEmblemGrad)" />
        <path d="M 67 111 L 93 111 L 90 107 L 70 107 Z" fill="url(#goldEmblemGrad)" />
        <rect x="63" y="111" width="34" height="4" rx="1.5" fill="url(#goldEmblemGrad)" />

        {/* Horizontal Balance Beam */}
        <path
          d="M 44 45 C 56 42 70 41 80 41 C 90 41 104 42 116 45"
          stroke="url(#goldEmblemGrad)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Beam Center Ring */}
        <circle cx="80" cy="41" r="5" stroke="url(#goldEmblemGrad)" strokeWidth="2.2" fill={THEME_COLORS.primaryNavy} />
        <circle cx="80" cy="41" r="2" fill="url(#goldEmblemGrad)" />

        {/* Left End Ring */}
        <circle cx="44" cy="45" r="2.8" stroke="url(#goldEmblemGrad)" strokeWidth="1.5" fill={THEME_COLORS.primaryNavy} />
        {/* Left Suspension Cords */}
        <line x1="44" y1="47" x2="34" y2="76" stroke="url(#goldEmblemGrad)" strokeWidth="1.3" />
        <line x1="44" y1="47" x2="54" y2="76" stroke="url(#goldEmblemGrad)" strokeWidth="1.3" />
        {/* Left Scale Pan */}
        <path
          d="M 30 76 Q 44 88 58 76 Z"
          fill="url(#goldPlateGrad)"
          stroke="url(#goldEmblemGrad)"
          strokeWidth="1.2"
        />

        {/* Right End Ring */}
        <circle cx="116" cy="45" r="2.8" stroke="url(#goldEmblemGrad)" strokeWidth="1.5" fill={THEME_COLORS.primaryNavy} />
        {/* Right Suspension Cords */}
        <line x1="116" y1="47" x2="106" y2="76" stroke="url(#goldEmblemGrad)" strokeWidth="1.3" />
        <line x1="116" y1="47" x2="126" y2="76" stroke="url(#goldEmblemGrad)" strokeWidth="1.3" />
        {/* Right Scale Pan */}
        <path
          d="M 102 76 Q 116 88 130 76 Z"
          fill="url(#goldPlateGrad)"
          stroke="url(#goldEmblemGrad)"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   SVG: Classical Courthouse Façade with Pillars and Golden Waves
   Uses exact palette: #0B2A4A, #071D34, #C99732, #E8C477
   ───────────────────────────────────────────────────────────── */
function CourthouseIllustration() {
  return (
    <svg
      viewBox="0 0 520 280"
      className="w-full h-auto max-h-[260px] pointer-events-none select-none overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="courtGoldLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={THEME_COLORS.primaryGold} />
          <stop offset="50%" stopColor={THEME_COLORS.lightGold} />
          <stop offset="100%" stopColor={THEME_COLORS.primaryGold} />
        </linearGradient>

        <linearGradient id="pillarShine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={THEME_COLORS.primaryNavy} stopOpacity="0.4" />
          <stop offset="35%" stopColor={THEME_COLORS.lightGold} stopOpacity="0.85" />
          <stop offset="70%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.9" />
          <stop offset="100%" stopColor={THEME_COLORS.deepNavy} stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="waveGoldGrad" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#9E731E" />
          <stop offset="30%" stopColor={THEME_COLORS.primaryGold} />
          <stop offset="60%" stopColor={THEME_COLORS.lightGold} />
          <stop offset="85%" stopColor={THEME_COLORS.primaryGold} />
          <stop offset="100%" stopColor="#7E560B" />
        </linearGradient>

        <linearGradient id="waveBackdrop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={THEME_COLORS.primaryNavy} stopOpacity="0.9" />
          <stop offset="100%" stopColor={THEME_COLORS.deepNavy} stopOpacity="0.95" />
        </linearGradient>

        <filter id="waveShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* ── Background Wings & Wall Silhouettes ── */}
      <g opacity="0.35">
        {/* Left Wing */}
        <rect x="70" y="110" width="130" height="90" fill={THEME_COLORS.primaryNavy} />
        <rect x="85" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <rect x="120" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <rect x="155" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <line x1="65" y1="110" x2="200" y2="110" stroke={THEME_COLORS.primaryGold} strokeWidth="2" />

        {/* Right Wing */}
        <rect x="330" y="110" width="130" height="90" fill={THEME_COLORS.primaryNavy} />
        <rect x="350" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <rect x="385" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <rect x="420" y="125" width="22" height="35" rx="11" fill={THEME_COLORS.deepNavy} stroke={THEME_COLORS.primaryGold} strokeWidth="0.8" />
        <line x1="330" y1="110" x2="465" y2="110" stroke={THEME_COLORS.primaryGold} strokeWidth="2" />
      </g>

      {/* ── Main Classical Temple Structure ── */}
      <g>
        {/* Triangular Pediment (Tympanum & Cornice) */}
        <polygon points="260,18 160,80 360,80" fill={THEME_COLORS.primaryNavy} stroke="url(#courtGoldLine)" strokeWidth="3.5" />
        <polygon points="260,26 172,80 348,80" fill={THEME_COLORS.deepNavy} stroke="url(#courtGoldLine)" strokeWidth="1.2" opacity="0.85" />

        {/* Scales Emblem inside Pediment Tympanum */}
        <g transform="translate(260, 56) scale(0.35)">
          <line x1="0" y1="-28" x2="0" y2="24" stroke={THEME_COLORS.lightGold} strokeWidth="4" />
          <path d="M -30,-8 Q 0,-14 30,-8" stroke={THEME_COLORS.lightGold} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="0" cy="-10" r="6" fill={THEME_COLORS.lightGold} />
          <line x1="-30" y1="-8" x2="-44" y2="16" stroke={THEME_COLORS.lightGold} strokeWidth="2" />
          <line x1="-30" y1="-8" x2="-16" y2="16" stroke={THEME_COLORS.lightGold} strokeWidth="2" />
          <path d="M -48,16 Q -30,28 -12,16 Z" fill={THEME_COLORS.lightGold} />
          <line x1="30" y1="-8" x2="16" y2="16" stroke={THEME_COLORS.lightGold} strokeWidth="2" />
          <line x1="30" y1="-8" x2="44" y2="16" stroke={THEME_COLORS.lightGold} strokeWidth="2" />
          <path d="M 12,16 Q 30,28 48,16 Z" fill={THEME_COLORS.lightGold} />
        </g>

        {/* Horizontal Entablature / Frieze under Pediment */}
        <rect x="154" y="80" width="212" height="12" fill={THEME_COLORS.primaryNavy} stroke="url(#courtGoldLine)" strokeWidth="2.5" />
        <rect x="158" y="92" width="204" height="6" fill={THEME_COLORS.deepNavy} stroke="url(#courtGoldLine)" strokeWidth="1" />

        {/* Classical Columns (Pillars) */}
        {[172, 204, 236, 284, 316, 348].map((colX, idx) => (
          <g key={idx}>
            <path
              d={`M ${colX - 8} 98 Q ${colX} 95 ${colX + 8} 98 L ${colX + 7} 104 L ${colX - 7} 104 Z`}
              fill="url(#courtGoldLine)"
            />
            <rect
              x={colX - 6}
              y="104"
              width="12"
              height="88"
              fill="url(#pillarShine)"
              stroke="url(#courtGoldLine)"
              strokeWidth="1"
            />
            <line x1={colX - 2} y1="105" x2={colX - 2} y2="191" stroke={THEME_COLORS.lightGold} strokeWidth="0.8" opacity="0.6" />
            <line x1={colX + 2} y1="105" x2={colX + 2} y2="191" stroke={THEME_COLORS.lightGold} strokeWidth="0.8" opacity="0.6" />
            <rect x={colX - 8} y="192" width="16" height="5" rx="1" fill="url(#courtGoldLine)" />
            <rect x={colX - 9} y="197" width="18" height="4" rx="1" fill="#A87A1E" />
          </g>
        ))}

        {/* Stepped Podium (Stairs) */}
        <polygon points="150,201 370,201 380,208 140,208" fill={THEME_COLORS.primaryNavy} stroke="url(#courtGoldLine)" strokeWidth="1.2" />
        <polygon points="138,208 382,208 394,217 126,217" fill={THEME_COLORS.deepNavy} stroke="url(#courtGoldLine)" strokeWidth="1" />
        <polygon points="124,217 396,217 410,227 110,227" fill="#051424" stroke="url(#courtGoldLine)" strokeWidth="0.8" />
        <polygon points="108,227 412,227 428,238 92,238" fill="#030C16" />
      </g>

      {/* ── Foreground Waves & Gold Ribbon ── */}
      <path
        d="M 60 270 Q 240 215 520 225 L 520 280 L 60 280 Z"
        fill="url(#waveBackdrop)"
        opacity="0.9"
      />

      <g filter="url(#waveShadow)">
        <path
          d="M 120 280 C 260 210 380 200 520 212 L 520 248 C 390 236 270 248 120 280 Z"
          fill="url(#waveGoldGrad)"
        />
        <path
          d="M 120 280 C 260 210 380 200 520 212"
          stroke="#FFF4DE"
          strokeWidth="2"
          fill="none"
        />
      </g>

      <path
        d="M 180 280 C 310 245 420 240 520 250"
        stroke={THEME_COLORS.lightGold}
        strokeWidth="1.5"
        fill="none"
        opacity="0.75"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   SVG: Ambient Golden Corner Flow Ribbons
   ───────────────────────────────────────────────────────────── */
function CornerRibbonTopLeft() {
  return (
    <svg
      viewBox="0 0 340 240"
      className="absolute top-0 left-0 w-80 h-60 pointer-events-none select-none opacity-80 overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cornerGoldTL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.8" />
          <stop offset="50%" stopColor={THEME_COLORS.lightGold} stopOpacity="0.9" />
          <stop offset="100%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d="M -40 120 C 60 90 140 40 240 -30 L 260 -30 C 150 45 70 100 -40 135 Z"
        fill="url(#cornerGoldTL)"
      />
      <path
        d="M -40 105 C 70 75 160 30 250 -30"
        stroke={THEME_COLORS.lightGold}
        strokeWidth="2.5"
        strokeOpacity="0.75"
        fill="none"
      />
    </svg>
  );
}

function CornerRibbonBottomRight() {
  return (
    <svg
      viewBox="0 0 340 240"
      className="absolute bottom-0 right-0 w-80 h-60 pointer-events-none select-none opacity-80 overflow-visible"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cornerGoldBR" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.8" />
          <stop offset="50%" stopColor={THEME_COLORS.lightGold} stopOpacity="0.9" />
          <stop offset="100%" stopColor={THEME_COLORS.primaryGold} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d="M 380 120 C 280 150 200 200 100 270 L 80 270 C 190 195 270 140 380 105 Z"
        fill="url(#cornerGoldBR)"
      />
      <path
        d="M 380 135 C 270 165 180 210 90 270"
        stroke={THEME_COLORS.lightGold}
        strokeWidth="2.5"
        strokeOpacity="0.75"
        fill="none"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Login Page Component
   ───────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    loginMutation.mutate(
      { data: { username: username.trim(), password: password.trim() } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation('/');
        },
        onError: (error: any) => {
          const detail = String(error?.data?.error || error?.message || '');
          let description = 'اسم المستخدم أو كلمة المرور غير صحيحة';

          // Strictly genericize any server error that discloses or names admin/login
          if (detail.includes('admin/login') || detail.includes('المشرف العام')) {
            description = 'اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب غير مصرح له بالدخول من هنا.';
          } else if (detail && detail !== 'Invalid username or password.') {
            description = detail;
          }

          setErrorMsg(description);
          toast({
            title: 'فشل تسجيل الدخول',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F5F7FB] text-[#10233F] relative overflow-hidden font-sans"
      dir="rtl"
    >
      {/* Corner Golden Flowing Waves */}
      <CornerRibbonTopLeft />
      <CornerRibbonBottomRight />

      {/* Main Split Floating Card */}
      {/* In RTL: First child in DOM is on the RIGHT side, Second child in DOM is on the LEFT side */}
      <div className="relative w-full max-w-[980px] bg-white rounded-[28px] sm:rounded-[34px] shadow-[0_20px_60px_-15px_rgba(11,42,74,0.12)] border border-[#D6E0EC] overflow-hidden flex flex-col md:flex-row z-10">

        {/* ── RIGHT PANEL (In RTL, 1st child is on the RIGHT on desktop; top on mobile): Navy Branding ── */}
        <div
          className="w-full md:w-[46%] p-8 sm:p-10 md:p-12 flex flex-col justify-between items-center text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${THEME_COLORS.primaryNavy} 0%, ${THEME_COLORS.deepNavy} 60%, #041222 100%)`,
          }}
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#C99732]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Branding Section */}
          <div className="relative z-10 pt-2 flex flex-col items-center">
            {/* Golden Laurel Wreath + Scales Emblem */}
            <LaurelScalesEmblem className="w-24 h-24 sm:w-28 sm:h-28 mb-4 drop-shadow-md" />

            {/* Main Title */}
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-wide">
              نظام إدارة
              <br />
              جلسات المحكمة
            </h2>

            {/* Subtitle Description */}
            <p className="text-xs sm:text-sm text-[#D6E0EC] font-normal leading-relaxed mt-4 max-w-[280px] opacity-90">
              إدارة منظمة وفعالة لجلسات المحكمة،
              <br />
              من الجدولة إلى المتابعة والتوثيق.
            </p>
          </div>

          {/* Bottom Courthouse Architecture Illustration with Golden Waves */}
          <div className="w-full mt-6 relative z-10">
            <CourthouseIllustration />
          </div>
        </div>

        {/* ── LEFT PANEL (In RTL, 2nd child is on the LEFT on desktop; bottom on mobile): White Form ── */}
        <div className="w-full md:w-[54%] p-7 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          {/* Top Pill Badge (aligned to the right side of the form) */}
          <div className="self-start mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FFF4DE] border border-[#E8C477]/60 text-[#C99732] text-xs font-bold shadow-xs">
              <Users className="w-4 h-4 text-[#C99732]" />
              <span>دخول المستخدمين</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6 sm:mb-8 text-right">
            <h1 className="text-2xl sm:text-3xl font-black text-[#10233F] tracking-tight">
              تسجيل الدخول إلى النظام
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-2 leading-relaxed">
              يرجى إدخال بيانات حسابك للوصول إلى نظام إدارة جلسات المحكمة
            </p>
          </div>

          {/* Error Message Box */}
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5 text-right">
              <Label htmlFor="username" className="text-xs sm:text-sm font-bold text-[#10233F]">
                اسم المستخدم
              </Label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المستخدم.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="username"
                  className="pr-10 pl-4 h-12 text-[#10233F] placeholder:text-[#64748B] font-medium rounded-xl border border-[#D6E0EC] bg-white focus:border-[#C99732] focus:ring-2 focus:ring-[#C99732]/20 transition-all text-sm"
                  data-testid="input-username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 text-right">
              <Label htmlFor="password" className="text-xs sm:text-sm font-bold text-[#10233F]">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال كلمة المرور.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="current-password"
                  className="pr-10 pl-11 h-12 text-[#10233F] placeholder:text-[#64748B] font-medium rounded-xl border border-[#D6E0EC] bg-white focus:border-[#C99732] focus:ring-2 focus:ring-[#C99732]/20 transition-all text-sm"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#10233F] transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-1">
              {/* Remember Me Checkbox */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D6E0EC] text-[#0B2A4A] accent-[#0B2A4A] focus:ring-[#C99732] cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-semibold text-[#10233F]">تذكرني</span>
              </label>

              {/* Forgot Password Link */}
              <button
                type="button"
                onClick={() => {
                  toast({
                    title: 'استعادة كلمة المرور',
                    description: 'يرجى التواصل مع مدير مكتبك أو المشرف لإعادة ضبط كلمة المرور.',
                  });
                }}
                className="text-xs sm:text-sm font-semibold text-[#C99732] hover:text-[#A87A1E] hover:underline transition-colors cursor-pointer"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-12 rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md shadow-[#C99732]/25 transition-all duration-200 cursor-pointer hover:brightness-105 active:scale-[0.99] border-0"
                style={{
                  background: `linear-gradient(135deg, ${THEME_COLORS.primaryGold} 0%, #B28325 100%)`,
                }}
                data-testid="button-login"
              >
                <LogIn className="w-5 h-5" />
                <span>{loginMutation.isPending ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
              </Button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
