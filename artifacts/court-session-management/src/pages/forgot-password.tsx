import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { validatePassword } from '@workspace/api-zod';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  KeyRound,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { THEME_COLORS } from '@/config/theme';

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Current Step: 1 = Request, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 State
  const [username, setUsername] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Step 2 State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Step 3 State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [revokeSessionsChecked] = useState(true); // Mandatory security requirement

  // Step 4 State
  const [redirectCountdown, setRedirectCountdown] = useState(4);

  // Countdown timer for Step 2
  useEffect(() => {
    if (step !== 2) return;
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timerSeconds]);

  // Auto redirect timer for Step 4
  useEffect(() => {
    if (step !== 4) return;
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLocation('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, setLocation]);

  // Live Password Validation for Step 3
  const passwordValidation = newPassword
    ? validatePassword(newPassword, { username: username.trim() })
    : { isValid: false, message: '' };

  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);

  let strengthLabel = 'ضعيف';
  let strengthColor = 'bg-rose-500';
  let strengthPercent = 25;
  if (passwordValidation.isValid) {
    strengthLabel = 'قوي';
    strengthColor = 'bg-emerald-500';
    strengthPercent = 100;
  } else if (hasMinLength && (hasUpper || hasLower) && hasDigitOrSpecial) {
    strengthLabel = 'متوسط';
    strengthColor = 'bg-amber-500';
    strengthPercent = 65;
  }

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────

  // Step 1: Submit Username
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setRequestError('يرجى إدخال اسم المستخدم.');
      return;
    }

    setIsRequesting(true);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });

      const data = await res.json().catch(() => ({}));
      // Username enumeration protection: always advance to Step 2
      toast({
        title: 'تم إرسال الطلب',
        description: data.message || 'إذا كان الحساب موجوداً، سيتم إرسال رمز إلى الرقم المسجل.',
      });

      setStep(2);
      setTimerSeconds(600); // 10 minutes
      // Focus first OTP input on next tick
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      // Still advance to step 2 to avoid timing / error leaks
      toast({
        title: 'تم إرسال الطلب',
        description: 'إذا كان الحساب موجوداً، سيتم إرسال رمز إلى الرقم المسجل.',
      });
      setStep(2);
      setTimerSeconds(600);
    } finally {
      setIsRequesting(false);
    }
  };

  // Step 2: OTP Digit Management
  const handleOtpChange = (index: number, value: string) => {
    const char = value.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    setVerifyError(null);

    // Auto-advance focus
    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pasteData) return;

    const digits = pasteData.slice(0, 6).split('');
    const newDigits = [...otpDigits];
    digits.forEach((d, i) => {
      newDigits[i] = d;
    });
    setOtpDigits(newDigits);

    // Focus last filled box
    const focusIdx = Math.min(digits.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  // Step 2: Submit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);

    const fullCode = otpDigits.join('').trim();
    if (fullCode.length !== 6) {
      setVerifyError('يرجى إدخال رمز التحقق المكون من 6 أرقام بالكامل.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          code: fullCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.resetToken) {
        setResetToken(data.resetToken);
        toast({
          title: 'تم التحقق من الرمز',
          description: 'يرجى تعيين كلمة المرور الجديدة الآن.',
        });
        setStep(3);
      } else {
        setVerifyError(data.error || 'رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى.');
      }
    } catch {
      setVerifyError('حدث خطأ في الاتصال بالخادم. يرجى إعادة المحاولة.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 3: Complete Password Reset
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!resetToken) {
      setPasswordError('جلسة إعادة التعيين غير صالحة. يرجى البدء من جديد.');
      setStep(1);
      return;
    }

    if (!newPassword) {
      setPasswordError('يرجى إدخال كلمة المرور الجديدة.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.message || 'كلمة المرور لا تستوفي شروط الأمان المطلوبة.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: 'تم تحديث كلمة المرور',
          description: data.message || 'تم تحديث كلمة المرور بنجاح.',
        });
        setStep(4);
      } else {
        setPasswordError(data.error || 'فشل تحديث كلمة المرور. يرجى المحاولة مرة أخرى.');
      }
    } catch {
      setPasswordError('تعذر الاتصال بالخادم لإتمام العملية.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#080d1a] font-sans text-right" dir="rtl">
      {/* ── LEFT HERO PANEL (Dark Branding & Aesthetics) ── */}
      <div className="hidden md:flex md:w-[46%] lg:w-[48%] bg-[#060a14] relative flex-col justify-between p-10 lg:p-14 overflow-hidden border-l border-white/5">
        {/* Background glow & subtle patterns */}
        <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#C99732]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400/80 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LEX ENGINE SAUDI ARABIA</span>
          </div>
        </div>

        {/* Center Scales Emblem */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 mb-6 rounded-2xl bg-gradient-to-b from-[#C99732]/20 to-transparent border border-[#C99732]/30 flex items-center justify-center shadow-2xl">
            <ShieldCheck className="w-12 h-12 text-[#E8C477]" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-wide">
            الريادة في حلول المحاماة الرقمية
          </h2>
          <p className="text-sm text-slate-400 mt-3 max-w-md leading-relaxed">
            بنية تحتية قانونية متكاملة مصممة لإدارة القضايا والترافع الذكي وفق المعايير والأنظمة العدلية.
          </p>
        </div>

        {/* Bottom Security Note */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5 pt-4">
          <span>بيئة موثقة ومشفرة بالكامل</span>
          <span>منظومة متوافقة مع متطلبات الأمن السيبراني</span>
        </div>
      </div>

      {/* ── RIGHT MAIN PANEL (Interactive Form Flow) ── */}
      <div className="flex-1 flex flex-col justify-between bg-white px-6 sm:px-12 lg:px-20 py-8 lg:py-12 min-h-screen">
        {/* Top Navigation & Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0b1b3d] flex items-center justify-center text-[#E8C477] font-bold text-sm">
              ⚖
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#0c1a30]">ميزان لتقنية المحاماة</div>
              <div className="text-[10px] text-slate-400">منظومة العدالة الذكية</div>
            </div>
          </div>

          <button
            onClick={() => setLocation('/login')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0b1b3d] transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-50"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة لتسجيل الدخول</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="max-w-md w-full mx-auto my-auto py-4">
          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SCREEN 1: Enter Username */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  الخطوة 1 من 3
                </span>
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> التحقق الثنائي
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0b1b3d] flex items-center justify-center mb-4 border border-slate-200">
                  <KeyRound className="w-6 h-6 text-[#0b1b3d]" />
                </div>
                <h1 className="text-2xl font-extrabold text-[#0c1a30]">استعادة كلمة المرور</h1>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  أدخل اسم المستخدم المسجل لإرسال رمز التحقق عبر الواتساب.
                </p>
              </div>

              {requestError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">اسم المستخدم *</Label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      required
                      placeholder="مثال: a.alotaibi أو admin_office"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pr-9 h-10 text-xs font-mono border-slate-200 focus:border-[#0b1b3d]"
                      dir="ltr"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isRequesting}
                  className="w-full h-11 bg-black hover:bg-slate-900 text-white font-bold text-xs gap-2 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  {isRequesting ? 'جارٍ التحقق...' : 'إرسال رمز التحقق عبر WhatsApp'}
                </Button>

                <div className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>يتم تسليم الرموز برمجياً عبر بوابة Meta Cloud المعتمدة لمكتبك</span>
                </div>
              </form>

              {/* Help Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">تواجه مشكلة في الوصول للرقم؟</div>
                  <div className="text-[11px] text-slate-500">تواصل مع مسؤول الأنظمة القانونية بالمكتب</div>
                </div>
                <button
                  type="button"
                  onClick={() => toast({ title: 'الدعم الفني', description: 'يرجى مراجعة مدير النظام بمكتبك لمساعدتك.' })}
                  className="text-xs font-bold text-[#0b1b3d] hover:underline"
                >
                  طلب مساعدة
                </button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SCREEN 2: 6-Digit WhatsApp OTP */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  الخطوة 2 من 3
                </span>
                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> في انتظار الرمز
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <h1 className="text-2xl font-extrabold text-[#0c1a30]">رمز التحقق</h1>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  تم إرسال رمز الأمان المكون من 6 أرقام عبر WhatsApp إلى رقم هاتفك المسجل.
                </p>
                <div className="mt-2 text-[11px] bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-600 font-medium">
                  المستخدم: <strong className="font-mono text-slate-900">{username}</strong> (إذا كان الحساب مسجلاً، ستصلك رسالة الواتساب بالرمز).
                </div>
              </div>

              {verifyError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5 text-xs">
                {/* 6 Digit Input Boxes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">أدخل رمز التحقق المباشر</Label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      صلاحية الرمز: {formatTimer(timerSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2" dir="ltr">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className="w-11 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#0b1b3d] focus:ring-2 focus:ring-[#0b1b3d]/20 transition-all outline-none"
                      />
                    ))}
                  </div>
                </div>

                {/* Resend button */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtpDigits(['', '', '', '', '', '']);
                      setVerifyError(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 text-[11px] underline cursor-pointer"
                  >
                    تغيير اسم المستخدم
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isRequesting}
                    className="text-[11px] font-bold text-[#0b1b3d] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة إرسال الرمز</span>
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isVerifying || otpDigits.join('').length !== 6}
                  className="w-full h-11 bg-black hover:bg-slate-900 text-white font-bold text-xs gap-2 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isVerifying ? 'جارٍ التحقق...' : 'تأكيد الرمز والمتابعة'}
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </Button>

                <div className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>اتصال مشفر وفق متطلبات الهيئة الوطنية للأمن السيبراني</span>
                </div>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SCREEN 3: New Password & Confirmation */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  الخطوة 3 من 3
                </span>
                <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> تحديث أمان الحساب
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
                  <Lock className="w-6 h-6 text-purple-600" />
                </div>
                <h1 className="text-2xl font-extrabold text-[#0c1a30]">كلمة المرور الجديدة</h1>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  يرجى إدخال كلمة مرور قوية لحماية حسابك الاستشاري وملفاتك.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleCompleteReset} className="space-y-4 text-xs">
                {/* New Password Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">كلمة المرور الجديدة *</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      className="pl-10 h-10 text-xs font-mono border-slate-200"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">مستوى القوة والأمان:</span>
                      <span className="font-bold">{strengthLabel}</span>
                    </div>

                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 pt-1">
                      <div className="flex items-center gap-1">
                        {hasMinLength ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                        <span>8 خانات على الأقل</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasUpper && hasLower ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                        <span>حرف كبير وحرف صغير</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasDigitOrSpecial ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                        <span>أرقام أو رموز خاصة</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {passwordValidation.isValid ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                        <span>غير مطابقة للاسم</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm Password Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">تأكيد كلمة المرور الجديدة *</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      className="pl-10 h-10 text-xs font-mono border-slate-200"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Security Session Revocation Option (Mandatory & Checked) */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={revokeSessionsChecked}
                    readOnly
                    className="w-4 h-4 text-black rounded border-slate-300 pointer-events-none accent-black"
                  />
                  <span>تسجيل الخروج الفوري من جميع الأجهزة والجلسات المفتوحة مسبقاً (إلزامي لضمان الأمان)</span>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmittingPassword || !passwordValidation.isValid || newPassword !== confirmPassword}
                  className="w-full h-11 bg-black hover:bg-slate-900 text-white font-bold text-xs gap-2 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isSubmittingPassword ? 'جارٍ الحفظ...' : 'تعيين كلمة المرور والمتابعة'}
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </Button>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* SCREEN 4: Success Screen */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-[#0c1a30]">تمت العملية بنجاح</h1>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
                  تم تحديث كلمة المرور الخاصة بحسابك، يمكنك الآن الدخول ومباشرة أعمالك القضائية بكامل الصلاحيات.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-medium">
                جاري التحويل تلقائياً إلى صفحة الدخول خلال ({redirectCountdown}) ثوانٍ...
              </div>

              <Button
                onClick={() => setLocation('/login')}
                className="w-full h-11 bg-black hover:bg-slate-900 text-white font-bold text-xs gap-2 rounded-xl shadow-md cursor-pointer"
              >
                <span>الانتقال إلى تسجيل الدخول</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Button>

              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>جلسة مشفرة ومؤمنة بالكامل وفق معايير الأمن السيبراني</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بيئة موثقة ومشفرة بالكامل</span>
          </div>
          <div className="flex items-center gap-2">
            <span>الشروط والخصوصية</span>
            <span>•</span>
            <span>المساعدة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
