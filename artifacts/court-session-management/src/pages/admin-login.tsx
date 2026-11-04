import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ShieldCheck, Lock, User, KeyRound, Sparkles, AlertCircle } from 'lucide-react';
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
      setErrorMsg('اسم المستخدم وكلمة المرور مطلوبان.');
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
        throw new Error(data.error || 'فشل تسجيل دخول المشرف العام.');
      }

      toast({
        title: 'أهلاً بك في لوحة الإدارة العامة',
        description: `تم تسجيل الدخول بنجاح بصلاحيات المشرف العام (${data.username}).`,
      });

      // Invalidate and refetch auth state before navigating
      await queryClient.invalidateQueries();
      navigate('/super-admin', { replace: true });
    } catch (err: any) {
      const detail = String(err.message || '');
      // Genericize error message without leaking portal details
      let msg = 'اسم المستخدم أو كلمة المرور غير صحيحة، أو لا تملك الصلاحية المطلوبة.';
      if (detail && !detail.includes('/login') && !detail.includes('المكاتب')) {
        msg = detail;
      }
      setErrorMsg(msg);
      toast({
        title: 'تعذر الدخول',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 bg-background text-foreground relative overflow-hidden"
      dir="rtl"
    >
      {/* Subtle warm decorative ambient shapes */}
      <div className="absolute top-12 right-12 w-80 h-80 bg-[#C9A449]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-12 left-12 w-80 h-80 bg-[#3F4A2C]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Main Card — Clean white card with soft border and subtle shadow */}
        <div className="rounded-3xl p-8 sm:p-10 bg-card border border-border shadow-md">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xs"
              style={{
                background: 'linear-gradient(135deg, #3F4A2C 0%, #313B22 100%)',
              }}
            >
              <ShieldCheck className="w-8 h-8 text-[#C9A449]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3 bg-[#C9A449]/15 text-[#8F7026] dark:text-[#E2C372] border border-[#C9A449]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A449]" />
              <span>الإدارة العامة للمنصة</span>
            </div>

            <h1 className="text-2xl font-black text-foreground tracking-tight">
              بوابة المشرف العام
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              الإدارة المركزية لحسابات المكاتب وتراخيص واشتراكات المنظومة
            </p>
          </div>

          {/* Error Message Box without cross-portal links */}
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin_username" className="text-xs font-bold text-foreground">
                اسم المستخدم
              </Label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin_username"
                  type="text"
                  required
                  placeholder="أدخل اسم المستخدم..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المستخدم.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="pr-10 h-11 text-foreground placeholder:text-muted-foreground/60 font-medium rounded-xl border-border bg-card focus:border-[#C9A449] focus:ring-1 focus:ring-[#C9A449]"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin_password" className="text-xs font-bold text-foreground">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin_password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال كلمة المرور.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="pr-10 h-11 text-foreground placeholder:text-muted-foreground/60 font-medium rounded-xl border-border bg-card focus:border-[#C9A449] focus:ring-1 focus:ring-[#C9A449]"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-bold text-sm text-white rounded-xl mt-3 transition-all duration-200 border-0 shadow-xs cursor-pointer hover:brightness-105"
              style={{
                background: 'linear-gradient(135deg, #3F4A2C 0%, #313B22 100%)',
              }}
            >
              <KeyRound className="w-4 h-4 ml-1.5 text-[#C9A449]" />
              {loading ? 'جارٍ التحقق...' : 'دخول المشرف العام'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          نظام إدارة الاشتراكات والمستخدمين — لوحة المشرف العام
        </p>
      </div>
    </div>
  );
}
