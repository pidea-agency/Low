import React, { useState } from 'react';
import { useLogin } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { User, Eye, EyeOff, AlertCircle, Scale, ShieldCheck, ArrowLeft, Fingerprint } from 'lucide-react';

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
    <div className="h-screen max-h-screen w-full flex flex-col md:flex-row-reverse bg-[#080d1a] font-sans text-right overflow-hidden" dir="rtl">
      {/* ── LEFT HERO PANEL (Dark Luxury Law Firm Branding) ── */}
      <div className="hidden md:flex md:w-[46%] lg:w-[48%] h-full bg-[#060a14] relative flex-col justify-between p-8 lg:p-12 overflow-hidden border-r border-[#C99732]/20 select-none">
        {/* Luxury Law Firm Office Hero Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{ backgroundImage: `url('/law-firm-hero.jpg')` }}
        />
        {/* Cinematic dark luxury gradient overlay & backdrop blur */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/85 to-[#060a14]/60 backdrop-blur-[0.5px]" />
        
        {/* Warm Golden Ambient Glows */}
        <div className="absolute inset-0 bg-radial from-[#C99732]/12 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#C99732]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#C99732]/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Bottom Hero Content */}
        <div className="relative z-10 space-y-4 px-20 py-40">
          <div className="space-y-3">
            {/* Justice Scales Badge */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C99732]/25 via-black/50 to-[#C99732]/10 border border-[#C99732]/45 flex items-center justify-center text-white shadow-[0_4px_24px_rgba(201,151,50,0.22)] backdrop-blur-md">
              <Scale className="w-6 h-6 text-[#E8C477]" />
            </div>

            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-wide leading-tight">
              الريادة في{' '}
              <span className="bg-gradient-to-l from-[#FFF4DE] via-[#E8C477] to-[#C99732] bg-clip-text text-transparent drop-shadow-sm">
                حلول المحاماة الرقمية
              </span>
            </h2>

            <p className="text-xs lg:text-sm text-slate-300/90 leading-relaxed max-w-md font-normal">
              بنية تحتية قانونية متكاملة مصممة لإدارة القضايا والترافع الذكي وفق المعايير والأنظمة العدلية.
            </p>
          </div>

          {/* Bottom Security Note (With Golden Accent) */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-[#C99732]/20 pt-3.5">
            <div className="flex items-center gap-1.5 text-[#E8C477]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E8C477]" />
              <span className="text-slate-300">بيئة موثقة ومشفرة بالكامل</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="hover:text-[#E8C477] transition-colors cursor-pointer">الشروط والخصوصية</span>
              <span>•</span>
              <span className="hover:text-[#E8C477] transition-colors cursor-pointer">المساعدة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT MAIN PANEL (Interactive Form Flow) ── */}
      <div className="flex-1 h-full flex flex-col justify-between bg-white px-6 sm:px-10 lg:px-16 py-6 sm:py-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          {/* Right: Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0b1b3d] flex items-center justify-center text-[#E8C477] font-bold text-sm shadow-sm">
              ⚖
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#0c1a30]">ميزان لتقنية المحاماة</div>
              <div className="text-[10px] text-slate-400">منظومة العدالة الذكية</div>
            </div>
          </div>

        
        </div>

        {/* Center: Main Form Area (Vertically Balanced) */}
        <div className="max-w-md w-full mx-auto my-auto py-2">
          <div className="text-right mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0c1a30] tracking-tight">تسجيل الدخول</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">الوصول إلى المنظومة القانونية</p>
          </div>

          {/* Error Message Box */}
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email Input */}
            <div className="space-y-1.5 text-right">
              <Label htmlFor="username" className="text-xs font-bold text-slate-700">
                اسم المستخدم   
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="lawyer@firm.sa"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المستخدم أو البريد.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="username"
                  className="pr-4 pl-10 h-11 text-slate-900 placeholder:text-slate-400 font-medium rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition-all text-sm"
                  data-testid="input-username"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 text-right">
              <Label htmlFor="password" className="text-xs font-bold text-slate-700">
                كلمة المرور
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال كلمة المرور.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="current-password"
                  className="pr-4 pl-11 h-11 text-slate-900 placeholder:text-slate-400 font-medium rounded-xl border border-slate-200 bg-[#F8FAFC] focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300 transition-all text-sm font-mono"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-0.5">
              {/* Remember Me Checkbox */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0B2A4A] accent-[#0B2A4A] focus:ring-[#C99732] cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-600">تذكرني</span>
              </label>

              {/* Forgot Password Link */}
              <button
                type="button"
                onClick={() => setLocation('/forgot-password')}
                className="text-xs font-semibold text-[#C99732] hover:text-[#A87A1E] hover:underline transition-colors cursor-pointer"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Primary Submit Button */}
            <div className="pt-1">
              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-11 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#C99732]/20 border-0 active:scale-[0.99] hover:brightness-105"
                style={{
                  background: 'linear-gradient(135deg, #C99732 0%, #B28325 100%)',
                }}
                data-testid="button-login"
              >
                <span>{loginMutation.isPending ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
                <ArrowLeft className="w-4 h-4 text-white" />
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs text-slate-400">
                <span className="bg-white px-3 font-medium">أو</span>
              </div>
            </div>

            {/* Nafath SSO Button */}
            <button
              type="button"
              onClick={() => {
                toast({
                  title: 'الدخول الموحد عبر نفاذ',
                  description: 'خدمة تسجيل الدخول بالنفاذ الوطني الموحد مخصصة للمحامين والممارسين المعتمدين.',
                });
              }}
              className="w-full h-11 rounded-xl bg-[#F0F5FF] hover:bg-[#E4EEFF] text-[#1E3A8A] font-bold text-sm flex items-center justify-center gap-2.5 border border-[#DBEAFE] transition-all cursor-pointer"
            >
              <Fingerprint className="w-4 h-4 text-[#2563EB]" />
              <span>الدخول الموحد عبر نفاذ</span>
            </button>

          
          </form>
        </div>

        {/* Bottom Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>بيئة موثقة ومشفرة بالكامل</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <button type="button" className="hover:text-slate-600 transition-colors">الشروط والخصوصية</button>
            <span>•</span>
            <button type="button" className="hover:text-slate-600 transition-colors">المساعدة</button>
          </div>
        </div>
      </div>
    </div>
  );
}
