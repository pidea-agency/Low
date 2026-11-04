import { useState } from 'react';
import { useLogin } from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Scale, Lock, User, ArrowLeft, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation('/');
        },
        onError: (error: any) => {
          const detail = error?.data?.error || error?.message;
          let description = 'اسم المستخدم أو كلمة المرور غير صحيحة';
          if (detail && detail !== 'Invalid username or password.') {
            description = `${detail}`;
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
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #093A2A 0%, #041812 60%, #020C09 100%)',
      }}
      dir="rtl"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#B88A3B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div
          className="rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-2xl"
          style={{
            background: 'rgba(5, 31, 23, 0.75)',
            border: '1px solid rgba(184, 138, 59, 0.25)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #B88A3B 0%, #8E6825 100%)',
                boxShadow: '0 8px 20px rgba(184, 138, 59, 0.35), inset 0 1px 1px rgba(255,255,255,0.4)',
              }}
            >
              <Scale className="w-8 h-8 text-white drop-shadow" />
            </div>

            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-2.5"
              style={{
                background: 'rgba(184, 138, 59, 0.15)',
                color: '#E5C07B',
                border: '1px solid rgba(184, 138, 59, 0.3)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>بوابة دخول المكاتب والمحامين (Office Portal)</span>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">
              تسجيل دخول المكتب
            </h1>
            <p className="text-xs text-emerald-200/70 mt-1.5">
              مخصص لمدراء المكاتب والمحامين لمتابعة القضايا، الجلسات، والموكلين
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 flex flex-col gap-2 text-red-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              {errorMsg.includes('admin/login') && (
                <Link href="/admin/login">
                  <span className="inline-flex items-center gap-1 text-[#E5C07B] hover:underline cursor-pointer font-bold pt-1">
                    الانتقال لبوابة المشرف العام (Super Admin)
                    <ArrowLeft className="w-3 h-3" />
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-emerald-100/80">
                اسم المستخدم (مدير المكتب أو المحامي)
              </Label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300/50" />
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
                  className="pr-10 h-11 text-white placeholder:text-emerald-300/30 font-medium rounded-xl border-emerald-500/20 focus:border-[#B88A3B] focus:ring-1 focus:ring-[#B88A3B]"
                  style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                  data-testid="input-username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-emerald-100/80">
                  كلمة المرور
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300/50" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال كلمة المرور.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="current-password"
                  className="pr-10 h-11 text-white placeholder:text-emerald-300/30 font-medium rounded-xl border-emerald-500/20 focus:border-[#B88A3B] focus:ring-1 focus:ring-[#B88A3B]"
                  style={{ background: 'rgba(0, 0, 0, 0.25)' }}
                  data-testid="input-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-bold text-sm text-white rounded-xl mt-3 transition-all duration-200 border-0 shadow-lg cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B88A3B 0%, #8E6825 100%)',
                boxShadow: '0 4px 15px rgba(184, 138, 59, 0.35)',
              }}
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          {/* Super Admin Portal Gateway Link */}
          <div className="mt-5 pt-4 text-center border-t border-white/10">
            <Link href="/admin/login">
              <span className="inline-flex items-center gap-2 text-xs text-emerald-200/60 hover:text-[#E5C07B] transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#B88A3B]" />
                <span>دخول مشرف المنصة العام (Super Admin)</span>
                <ArrowLeft className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">
          نظام إدارة الجلسات والدعاوى القضائية — بوابة المكاتب والمحامين
        </p>
      </div>
    </div>
  );
}
