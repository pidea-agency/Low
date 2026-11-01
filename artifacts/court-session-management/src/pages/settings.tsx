import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  Settings2,
  Bot,
  Sheet,
  MessageSquare,
  Send,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SettingsData {
  aiApiKey: string;
  aiApiKeyIsSet: boolean;
  aiModel: string;
  aiBaseUrl: string;
  googleSpreadsheetId: string;
  googleSheetName: string;
  hfApiToken: string;
  hfApiTokenIsSet: boolean;
  hfModel: string;
  whatsappNumber: string;
  whatsappApiUrl: string;
  whatsappToken: string;
  whatsappTokenIsSet: boolean;
  whatsappInstanceId: string;
}

interface SettingsFormState {
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  googleSpreadsheetId: string;
  googleSheetName: string;
  hfApiToken: string;
  hfModel: string;
  whatsappNumber: string;
  whatsappApiUrl: string;
  whatsappToken: string;
  whatsappInstanceId: string;
}

async function fetchSettings(): Promise<SettingsData> {
  const res = await fetch('/api/settings', { credentials: 'include' });
  if (res.status === 401) {
    throw new Error('يرجى تسجيل الدخول أولاً لتصفح الإعدادات');
  }
  if (!res.ok) {
    throw new Error(`فشل تحميل الإعدادات (${res.status})`);
  }
  return res.json() as Promise<SettingsData>;
}

async function updateSettings(body: Partial<SettingsFormState>): Promise<SettingsData> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'فشل حفظ الإعدادات');
  }
  return res.json() as Promise<SettingsData>;
}

async function triggerTestWhatsapp(): Promise<{ message: string }> {
  const res = await fetch('/api/settings/test-whatsapp', {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'فشل إجراء تجربة الواتساب');
  }
  return res.json() as Promise<{ message: string }>;
}

function SettingField({
  id,
  label,
  description,
  placeholder,
  value,
  onChange,
  type = 'text',
  mono = false,
  dir = 'ltr',
  testId,
  rightContent,
}: {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  testId?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${mono ? 'font-mono' : ''} h-9 text-sm ${rightContent ? 'pe-10' : ''}`}
          dir={dir}
          data-testid={testId}
          autoComplete="off"
        />
        {rightContent && (
          <div className="absolute inset-y-0 end-0 px-3 flex items-center">
            {rightContent}
          </div>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: currentUser, isLoading: userLoading } = useGetCurrentUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenIsSet, setTokenIsSet] = useState(false);
  
  const [showHfToken, setShowHfToken] = useState(false);
  const [hfTokenIsSet, setHfTokenIsSet] = useState(false);

  const [showWaToken, setShowWaToken] = useState(false);
  const [waTokenIsSet, setWaTokenIsSet] = useState(false);

  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [form, setForm] = useState<SettingsFormState>({
    aiApiKey: '',
    aiModel: '',
    aiBaseUrl: '',
    googleSpreadsheetId: '',
    googleSheetName: '',
    hfApiToken: '',
    hfModel: '',
    whatsappNumber: '',
    whatsappApiUrl: '',
    whatsappToken: '',
    whatsappInstanceId: '',
  });

  const [maskedToken, setMaskedToken] = useState('');
  const [maskedHfToken, setMaskedHfToken] = useState('');
  const [maskedWaToken, setMaskedWaToken] = useState('');

  useEffect(() => {
    if (userLoading || currentUser?.role !== 'admin') return;

    setLoading(true);
    fetchSettings()
      .then((data) => {
        setTokenIsSet(data.aiApiKeyIsSet);
        setMaskedToken(data.aiApiKey);
        setHfTokenIsSet(data.hfApiTokenIsSet);
        setMaskedHfToken(data.hfApiToken);
        setWaTokenIsSet(data.whatsappTokenIsSet);
        setMaskedWaToken(data.whatsappToken);

        setForm({
          aiApiKey: '',
          aiModel: data.aiModel,
          aiBaseUrl: data.aiBaseUrl,
          googleSpreadsheetId: data.googleSpreadsheetId,
          googleSheetName: data.googleSheetName,
          hfApiToken: '',
          hfModel: data.hfModel,
          whatsappNumber: data.whatsappNumber,
          whatsappApiUrl: data.whatsappApiUrl,
          whatsappToken: '',
          whatsappInstanceId: data.whatsappInstanceId,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'فشل تحميل الإعدادات';
        toast({ title: 'خطأ', description: msg, variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [userLoading, currentUser, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<SettingsFormState> = {
        aiModel: form.aiModel,
        aiBaseUrl: form.aiBaseUrl,
        googleSpreadsheetId: form.googleSpreadsheetId,
        googleSheetName: form.googleSheetName,
        hfModel: form.hfModel,
        whatsappNumber: form.whatsappNumber,
        whatsappApiUrl: form.whatsappApiUrl,
        whatsappInstanceId: form.whatsappInstanceId,
      };
      if (form.aiApiKey.trim()) {
        payload.aiApiKey = form.aiApiKey.trim();
      }
      if (form.hfApiToken.trim()) {
        payload.hfApiToken = form.hfApiToken.trim();
      }
      if (form.whatsappToken.trim()) {
        payload.whatsappToken = form.whatsappToken.trim();
      }

      const updated = await updateSettings(payload);
      setTokenIsSet(updated.aiApiKeyIsSet);
      setMaskedToken(updated.aiApiKey);
      setHfTokenIsSet(updated.hfApiTokenIsSet);
      setMaskedHfToken(updated.hfApiToken);
      setWaTokenIsSet(updated.whatsappTokenIsSet);
      setMaskedWaToken(updated.whatsappToken);

      setForm((prev) => ({
        ...prev,
        aiApiKey: '',
        hfApiToken: '',
        whatsappToken: '',
      }));
      setSavedAt(new Date());
      toast({ title: 'تم الحفظ ✅', description: 'تم حفظ الإعدادات بنجاح.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ الإعدادات';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setTestingWhatsapp(true);
    try {
      const res = await triggerTestWhatsapp();
      toast({
        title: 'نجاح الإرسال 📲',
        description: res.message || 'تم إرسال رسالة الواتساب التجريبية بنجاح.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إرسال رسالة الواتساب';
      toast({ title: 'خطأ في الإرسال', description: msg, variant: 'destructive' });
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const field = (k: keyof SettingsFormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-muted-foreground">جارٍ التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4 text-destructive shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">غير مصرح بالوصول</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed" data-testid="text-forbidden-message">
          ليس لديك صلاحية للوصول إلى هذه الصفحة.
        </p>
        <Button
          onClick={() => navigate('/')}
          className="gap-2 font-medium"
          data-testid="button-return-dashboard"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى لوحة التحكم
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-muted-foreground">جارٍ تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">إعدادات المنصة</h1>
        </div>
        <p className="text-muted-foreground text-sm mr-3">
          تحكّم في إعدادات تذكير الواتساب، مفاتيح الذكاء الاصطناعي، والربط مع Google Sheets
        </p>
      </div>

      {/* Saved Alert */}
      {savedAt && (
        <div className="fade-in-up rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            آخر حفظ: {savedAt.toLocaleTimeString('ar-SA')}
          </p>
        </div>
      )}

      {/* Google Sheets Settings Card */}
      <div className="fade-in-up rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/40">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Sheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">جوجل شيت (Google Sheets)</p>
            <p className="text-xs text-muted-foreground">
              معرّف الجدول واسم ورقة العمل المستخدمة لتخزين الجلسات
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <SettingField
            id="googleSpreadsheetId"
            label="معرّف الجدول (Spreadsheet ID)"
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            value={form.googleSpreadsheetId}
            onChange={(v) => field('googleSpreadsheetId', v)}
            mono
            dir="ltr"
            description="انسخ المعرّف من رابط جدول جوجل الخاص بك بين /d/ و /edit"
            testId="input-google-spreadsheet-id"
          />

          <SettingField
            id="googleSheetName"
            label="اسم ورقة العمل (Sheet Name)"
            placeholder="Sheet1"
            value={form.googleSheetName}
            onChange={(v) => field('googleSheetName', v)}
            description="اسم التبويب داخل ملف الإكسل (الافتراضي: Sheet1)"
            testId="input-google-sheet-name"
          />
        </div>
      </div>

      {/* WhatsApp Reminders Settings Card */}
      <div className="fade-in-up rounded-xl border border-emerald-500/30 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                إعدادات تذكير الواتساب (WhatsApp Gateway)
              </p>
              <p className="text-xs text-muted-foreground">
                إرسال التنبيهات الآلية قبل الجلسات بـ 24 ساعة للمحامين والموكلين
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestWhatsapp}
            disabled={testingWhatsapp}
            className="gap-2 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          >
            <Send className="w-3.5 h-3.5" />
            {testingWhatsapp ? 'جارٍ الإرسال التجريبي...' : 'إرسال رسالة تجريبية'}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <SettingField
            id="whatsappNumber"
            label="رقم الهاتف المستلم الافتراضي للتنبيهات"
            placeholder="966500000000"
            value={form.whatsappNumber}
            onChange={(v) => field('whatsappNumber', v)}
            mono
            dir="ltr"
            description="الرقم بصيغة دولية بدون أصفار أو علامة + (مثال: 966501234567)"
          />

          <SettingField
            id="whatsappApiUrl"
            label="رابط الـ API لبوابة الواتساب (WhatsApp Gateway URL)"
            placeholder="https://api.ultramsg.com أو https://api.green-api.com"
            value={form.whatsappApiUrl}
            onChange={(v) => field('whatsappApiUrl', v)}
            mono
            dir="ltr"
            description="رابط خدمة الواتساب المستخدمة (UltraMsg / GreenAPI / Custom Webhook)"
          />

          <SettingField
            id="whatsappInstanceId"
            label="معرّف المثيل (Instance ID / Channel ID)"
            placeholder="instance123456"
            value={form.whatsappInstanceId}
            onChange={(v) => field('whatsappInstanceId', v)}
            mono
            dir="ltr"
            description="رقم المثيل من لوحة تحكم مزود خدمة الواتساب"
          />

          <div className="space-y-1.5">
            <Label htmlFor="whatsappToken" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              رمز التوثيق / التوكن (WhatsApp Token / API Key)
              {waTokenIsSet && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case tracking-normal text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ✔ محدَّد
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="whatsappToken"
                type={showWaToken ? 'text' : 'password'}
                placeholder={
                  waTokenIsSet
                    ? `القيمة الحالية: ${maskedWaToken} — اتركه فارغاً للإبقاء عليها`
                    : 'أدخل توكن الواتساب هنا...'
                }
                value={form.whatsappToken}
                onChange={(e) => field('whatsappToken', e.target.value)}
                className="font-mono h-9 text-sm pe-10"
                dir="ltr"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowWaToken((v) => !v)}
                tabIndex={-1}
              >
                {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              مفتاح الأمان الخاص بربط الواتساب.
            </p>
          </div>
        </div>
      </div>

      {/* AI Settings Card */}
      <div className="fade-in-up rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/40">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">الذكاء الاصطناعي (AI Integration)</p>
            <p className="text-xs text-muted-foreground">
              مفتاح ونموذج الذكاء الاصطناعي لتحليل رسائل الجلسات واستخراج البيانات
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="aiApiKey" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              مفتاح API الأساسي (AI API Key)
              {tokenIsSet && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case tracking-normal text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ✔ محدَّد
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="aiApiKey"
                type={showToken ? 'text' : 'password'}
                placeholder={
                  tokenIsSet
                    ? `القيمة الحالية: ${maskedToken} — اتركه فارغاً للإبقاء عليها`
                    : 'gsk_... أو AIzaSy... أو sk-...'
                }
                value={form.aiApiKey}
                onChange={(e) => field('aiApiKey', e.target.value)}
                className="font-mono h-9 text-sm pe-10"
                dir="ltr"
                data-testid="input-ai-api-key"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowToken((v) => !v)}
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              يدعم مفاتيح: <strong>Groq (مجاني وفائق السرعة gsk_...)</strong>، <strong>Google Gemini (AIzaSy...)</strong>، أو <strong>OpenAI (sk-...)</strong>
            </p>
          </div>

          <SettingField
            id="aiModel"
            label="اسم النموذج (AI Model)"
            placeholder="llama-3.3-70b-versatile أو gemini-2.0-flash أو gpt-4o-mini"
            value={form.aiModel}
            onChange={(v) => field('aiModel', v)}
            mono
            dir="ltr"
            description="الافتراضي: llama-3.3-70b-versatile (سريع ودقيق جداً للغة العربية)"
            testId="input-ai-model"
          />

          <SettingField
            id="aiBaseUrl"
            label="رابط Base URL المخصص (اختياري)"
            placeholder="https://api.groq.com/openai/v1"
            value={form.aiBaseUrl}
            onChange={(v) => field('aiBaseUrl', v)}
            mono
            dir="ltr"
            description="اتركه فارغاً للاستخدام الافتراضي أو أدخل رابط مزود متوافق مع OpenAI"
            testId="input-ai-base-url"
          />
        </div>
      </div>

      {/* HuggingFace Fallback Card */}
      <div className="fade-in-up rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/40">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">نموذج احتياطي (Hugging Face Fallback)</p>
            <p className="text-xs text-muted-foreground">
              يُستخدم تلقائياً كبديل في حال تعذّر الاتصال بالنموذج الأساسي
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hfApiToken" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              رمز Hugging Face (API Token)
              {hfTokenIsSet && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case tracking-normal text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ✔ محدَّد
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="hfApiToken"
                type={showHfToken ? 'text' : 'password'}
                placeholder={
                  hfTokenIsSet
                    ? `القيمة الحالية: ${maskedHfToken} — اتركه فارغاً للإبقاء عليها`
                    : 'hf_...'
                }
                value={form.hfApiToken}
                onChange={(e) => field('hfApiToken', e.target.value)}
                className="font-mono h-9 text-sm pe-10"
                dir="ltr"
                data-testid="input-hf-api-token"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHfToken((v) => !v)}
                tabIndex={-1}
              >
                {showHfToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <SettingField
            id="hfModel"
            label="اسم نموذج Hugging Face"
            placeholder="meta-llama/Llama-3.1-8B-Instruct"
            value={form.hfModel}
            onChange={(v) => field('hfModel', v)}
            mono
            dir="ltr"
            testId="input-hf-model"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="fade-in-up flex items-center justify-end gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 px-6 h-10 text-sm font-semibold"
          data-testid="button-save-settings"
        >
          <Save className="w-4 h-4" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>
    </div>
  );
}
