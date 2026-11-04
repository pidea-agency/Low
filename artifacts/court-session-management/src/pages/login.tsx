import { useState } from 'react';
import { useLogin } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Scale, Lock, User, AlertCircle, Sparkles } from 'lucide-react';

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
              <Scale className="w-8 h-8 text-[#C9A449]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3 bg-[#C9A449]/15 text-[#8F7026] dark:text-[#E2C372] border border-[#C9A449]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A449]" />
              <span>بوابة الدخول الموحدة للمكاتب</span>
            </div>

            <h1 className="text-2xl font-black text-foreground tracking-tight">
              تسجيل الدخول
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              منظومة إدارة الجلسات والدعاوى القضائية والوكالات الشرعية
            </p>
          </div>

          {/* Error Message Box without any admin links or path disclosure */}
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-bold text-foreground">
                اسم المستخدم
              </Label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم..."
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المستخدم.')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  disabled={loginMutation.isPending}
                  autoComplete="username"
                  className="pr-10 h-11 text-foreground placeholder:text-muted-foreground/60 font-medium rounded-xl border-border bg-card focus:border-[#C9A449] focus:ring-1 focus:ring-[#C9A449]"
                  data-testid="input-username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-foreground">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  className="pr-10 h-11 text-foreground placeholder:text-muted-foreground/60 font-medium rounded-xl border-border bg-card focus:border-[#C9A449] focus:ring-1 focus:ring-[#C9A449]"
                  data-testid="input-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-bold text-sm text-white rounded-xl mt-3 transition-all duration-200 border-0 shadow-xs cursor-pointer hover:brightness-105"
              style={{
                background: 'linear-gradient(135deg, #3F4A2C 0%, #313B22 100%)',
              }}
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          نظام إدارة الجلسات والدعاوى القضائية — جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
