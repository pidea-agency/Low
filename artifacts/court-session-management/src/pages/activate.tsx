import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { validatePassword } from '@workspace/api-zod';

interface TokenInfo {
  username: string;
  displayName: string;
  email: string | null;
  officeName: string;
}

export default function ActivatePage() {
  const [, setLocation] = useLocation();

  // Extract token from query params: ?token=...
  const [token, setToken] = useState<string>('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenReason, setTokenReason] = useState<string | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token') || '';
    setToken(rawToken);

    if (!rawToken || rawToken.trim().length < 8) {
      setIsLoading(false);
      setTokenError('رابط التفعيل غير مكتمل أو مفقود. يرجى التأكد من الضغط على الرابط الصحيح المرسل إلى بريدك الإلكتروني.');
      setTokenReason('invalid');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/activate/${encodeURIComponent(rawToken.trim())}`);
        const data = await res.json();

        if (!res.ok) {
          setTokenError(data.error || 'رابط التفعيل غير صالح أو منتهي الصلاحية.');
          setTokenReason(data.reason || (res.status === 410 ? 'expired' : 'invalid'));
          return;
        }

        setTokenInfo({
          username: data.username,
          displayName: data.displayName,
          email: data.email,
          officeName: data.officeName || 'مكتب المحاماة',
        });
      } catch {
        setTokenError('تعذر التحقق من رابط التفعيل بسبب مشكلة في الاتصال بالخادم. يرجى المحاولة لاحقاً.');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  // Countdown timer on success
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, setLocation]);

  // Live password evaluation
  const passwordValidation = tokenInfo
    ? validatePassword(password, { username: tokenInfo.username, email: tokenInfo.email || undefined })
    : { isValid: false, message: '' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password) {
      setSubmitError('يرجى إدخال كلمة المرور.');
      return;
    }

    if (password !== passwordConfirmation) {
      setSubmitError('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    if (!passwordValidation.isValid) {
      setSubmitError(passwordValidation.message || 'كلمة المرور غير صالحة ولا تستوفي الشروط.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          password,
          password_confirmation: passwordConfirmation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تفعيل الحساب.');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'حدث خطأ أثناء تفعيل الحساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-muted/40 flex flex-col justify-center items-center p-4 sm:p-6"
      dir="rtl"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">منظومة إدارة الجلسات والمكاتب</h2>
          <p className="text-xs text-muted-foreground">تفعيل حساب المحامي وتعيين كلمة المرور</p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <Card className="border-border shadow-xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">جاري التحقق من صلاحية رابط التفعيل...</p>
            </CardContent>
          </Card>
        )}

        {/* Error state (Invalid or Expired) */}
        {!isLoading && tokenError && (
          <Card className="border-border shadow-xl">
            <CardHeader className="text-center pb-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">
                {tokenReason === 'expired' ? 'رابط التفعيل منتهي الصلاحية' : 'رابط تفعيل غير صالح'}
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground pt-1">
                {tokenError}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="bg-muted/50 border border-border rounded-xl p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">ماذا يمكنك أن تفعل الآن؟</p>
                <p>
                  يرجى التواصل مع مدير مكتبك واطلب منه الدخول إلى صفحة <strong>أعضاء المكتب</strong> والضغط على زر{' '}
                  <span className="text-primary font-medium">"إعادة إرسال رابط التفعيل"</span> بجانب اسم حسابك لتصلك دعوة جديدة.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setLocation('/login')}
                className="w-full text-xs font-semibold gap-2"
              >
                العودة لصفحة تسجيل الدخول
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success state */}
        {!isLoading && isSuccess && (
          <Card className="border-emerald-500/30 bg-card shadow-xl">
            <CardHeader className="text-center pb-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">تم تفعيل حسابك بنجاح!</CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                تم حفظ كلمة المرور الخاصة بك وتنشيط حسابك في المكتب. يمكنك الآن تسجيل الدخول مباشرة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <Button
                onClick={() => setLocation('/login')}
                className="w-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                الانتقال إلى تسجيل الدخول ({countdown})
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Activation Form */}
        {!isLoading && !tokenError && !isSuccess && tokenInfo && (
          <Card className="border-border shadow-xl">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="gap-1 text-[11px] bg-primary/5 text-primary border-primary/20">
                  <Sparkles className="w-3 h-3" /> دعوة انضمام
                </Badge>
                <span className="text-[11px] text-muted-foreground">{tokenInfo.officeName}</span>
              </div>
              <CardTitle className="text-lg font-bold text-foreground pt-2">
                مرحباً بك، {tokenInfo.displayName}
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                تمت دعوتك للانضمام إلى <strong>{tokenInfo.officeName}</strong>. يرجى تعيين كلمة المرور لتفعيل حسابك والبدء في استخدام المنظومة.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Account details overview */}
                <div className="bg-muted/40 border border-border rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" /> اسم المستخدم:
                    </span>
                    <span className="font-mono font-bold text-foreground">{tokenInfo.username}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> المكتب:
                    </span>
                    <span className="font-semibold text-foreground truncate block">{tokenInfo.officeName}</span>
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">كلمة المرور الجديدة *</Label>
                  <div className="relative">
                    <Input
                      required
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="text-xs h-10 pr-3 pl-10 font-mono"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Confirmation */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">تأكيد كلمة المرور *</Label>
                  <Input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="text-xs h-10 font-mono"
                  />
                  {passwordConfirmation && password !== passwordConfirmation && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 pt-0.5">
                      <AlertCircle className="w-3 h-3" /> كلمتا المرور غير متطابقتين
                    </p>
                  )}
                </div>

                {/* Password Policy feedback */}
                {password.length > 0 && !passwordValidation.isValid && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <p className="font-semibold">{passwordValidation.message}</p>
                  </div>
                )}

                {/* Submit Error Alert */}
                {submitError && (
                  <Alert variant="destructive" className="py-2 text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || !password || password !== passwordConfirmation}
                  className="w-full text-xs font-bold h-10 gap-2"
                >
                  {isSubmitting ? (
                    'جاري تفعيل الحساب...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      تفعيل الحساب وحفظ كلمة المرور
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer note */}
        <p className="text-center text-[11px] text-muted-foreground">
          هل لديك حساب مفعل بالفعل؟{' '}
          <button
            onClick={() => setLocation('/login')}
            className="text-primary hover:underline font-semibold"
          >
            تسجيل الدخول
          </button>
        </p>
      </div>
    </div>
  );
}
