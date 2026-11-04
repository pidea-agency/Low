import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { ShieldCheck, Lock, User, ArrowLeft, ShieldAlert, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('اسم المشرف وكلمة المرور مطلوبان.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل دخول المشرف');
      }

      toast({
        title: 'أهلاً بك في لوحة الإدارة 👑',
        description: `تم تسجيل الدخول بنجاح بصلاحيات المشرف العام (${data.username}).`,
      });

      // Invalidate and refetch auth state before navigating
      await queryClient.invalidateQueries();
      navigate('/super-admin', { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'بيانات الدخول غير صحيحة أو لا تملك صلاحية المشرف العام.');
      toast({
        title: 'تعذر الدخول',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #1A1305 0%, #0D0A02 50%, #050401 100%)',
      }}
      dir="rtl"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-yellow-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div
          className="rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-2xl"
          style={{
            background: 'rgba(18, 14, 5, 0.85)',
            border: '1px solid rgba(184, 138, 59, 0.35)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #B88A3B 0%, #8E6825 100%)',
                boxShadow: '0 8px 24px rgba(184, 138, 59, 0.45), inset 0 1px 1px rgba(255,255,255,0.4)',
              }}
            >
              <ShieldCheck className="w-8 h-8 text-white drop-shadow" />
            </div>

            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-2.5"
              style={{
                background: 'rgba(184, 138, 59, 0.18)',
                color: '#E5C07B',
                border: '1px solid rgba(184, 138, 59, 0.35)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Super Admin Portal — المشرف العام للمنصة فقط</span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">
              بوابة مشرف المنصة العام
            </h1>
            <p className="text-xs text-amber-200/60 mt-1.5">
              الإدارة المركزية لاشتراكات مكاتب المحاماة وتراخيص المنظومة
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 flex flex-col gap-2 text-red-200 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              {(errorMsg.includes('العادية') || errorMsg.includes('المكاتب') || errorMsg.includes('/login')) && (
                <Link href="/login">
                  <span className="inline-flex items-center gap-1 text-[#E5C07B] hover:underline cursor-pointer font-bold pt-1">
                    الانتقال لبوابة دخول المكاتب والمحامين (/login)
                    <ArrowLeft className="w-3 h-3" />
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin_username" className="text-xs font-semibold text-amber-100/80">
                اسم المشرف العام (Super Admin Username)
              </Label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-300/50" />
                <Input
                  id="admin_username"
                  type="text"
                  required
                  placeholder="اسم المشرف العام"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المشرف.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="pr-10 h-11 text-white placeholder:text-amber-200/30 font-mono text-sm rounded-xl border-amber-500/20 focus:border-[#B88A3B] focus:ring-1 focus:ring-[#B88A3B]"
                  style={{ background: 'rgba(0, 0, 0, 0.35)' }}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin_password" className="text-xs font-semibold text-amber-100/80">
                كلمة المرور (Master Password)
              </Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-300/50" />
                <Input
                  id="admin_password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال كلمة المرور.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="pr-10 h-11 text-white placeholder:text-amber-200/30 font-mono text-sm rounded-xl border-amber-500/20 focus:border-[#B88A3B] focus:ring-1 focus:ring-[#B88A3B]"
                  style={{ background: 'rgba(0, 0, 0, 0.35)' }}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-bold text-sm text-white rounded-xl mt-3 transition-all duration-200 border-0 shadow-lg cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B88A3B 0%, #8E6825 100%)',
                boxShadow: '0 4px 15px rgba(184, 138, 59, 0.4)',
              }}
            >
              <KeyRound className="w-4 h-4 ml-1" />
              {loading ? 'جارٍ التحقق من المشرف...' : 'دخول المشرف العام'}
            </Button>
          </form>

          {/* Back to Office Portal Link */}
          <div className="mt-5 pt-4 text-center border-t border-white/10">
            <Link href="/login">
              <span className="inline-flex items-center gap-2 text-xs text-amber-200/60 hover:text-[#E5C07B] transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-white/5">
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                <span>العودة لبوابة دخول المكاتب والمحامين (/login)</span>
              </span>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">
          نظام إدارة الاشتراكات والمستخدمين — لوحة المشرف العام
        </p>
      </div>
    </div>
  );
}
