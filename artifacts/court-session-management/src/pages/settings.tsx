import React, { useState, useEffect } from 'react';
import {
  Sheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Upload,
  FileCode,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Unlink,
  MessageSquare,
  Send,
  HelpCircle,
  Sparkles,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';

interface GoogleBindingState {
  is_connected: boolean;
  client_email: string | null;
  spreadsheet_id: string | null;
  sheet_name: string | null;
  office_name: string | null;
}

const WIZARD_STEPS = [
  { id: 1, title: 'المقدمة', desc: 'المتطلبات الأساسية' },
  { id: 2, title: 'مشروع Google', desc: 'تفعيل Sheets API' },
  { id: 3, title: 'حساب الخدمة', desc: 'تنزيل مفتاح JSON' },
  { id: 4, title: 'رفع المفتاح', desc: 'التحقق واستخراج الإيميل' },
  { id: 5, title: 'مشاركة الشيت', desc: 'منح صلاحية محرر' },
  { id: 6, title: 'معرف الجدول', desc: 'رابط الورقة والاسم' },
  { id: 7, title: 'فحص الاتصال', desc: 'الاختبار والحفظ' },
];

export default function OfficeSettingsPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const [activeTab, setActiveTab] = useState<'google' | 'whatsapp'>('google');
  const [binding, setBinding] = useState<GoogleBindingState | null>(null);
  const [isLoadingBinding, setIsLoadingBinding] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [jsonContent, setJsonContent] = useState('');
  const [extractedEmail, setExtractedEmail] = useState('');
  const [sheetInput, setSheetInput] = useState('');
  const [sheetName, setSheetName] = useState('Sessions');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    sheet_title?: string;
  } | null>(null);
  const [isSavingBinding, setIsSavingBinding] = useState(false);

  // WhatsApp settings state
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappApiUrl, setWhatsappApiUrl] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappInstanceId, setWhatsappInstanceId] = useState('');
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportToSheets = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/settings/google-export', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'تم التصدير بنجاح ✓',
          description: `تم تصدير ${data.sessionsCount ?? 0} جلسة، و ${data.tasksCount ?? 0} مهمة، و ${data.poaCount ?? 0} وكالة، و ${data.judgmentsCount ?? 0} حكماً إلى Google Sheets.`,
        });
      } else {
        toast({
          title: 'فشل التصدير',
          description: data.error || 'تعذر تصدير البيانات إلى Google Sheets.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'تعذر الاتصال بالخادم.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const fetchBinding = async () => {
    setIsLoadingBinding(true);
    try {
      const res = await fetch('/api/settings/google-binding');
      const data = await res.json();
      setBinding(data);
      if (!data.is_connected) {
        setShowWizard(true);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب حالة ربط Google Sheet.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBinding(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        setWhatsappNumber(data.whatsappNumber || '');
        setWhatsappApiUrl(data.whatsappApiUrl || '');
        setWhatsappToken(data.whatsappToken || '');
        setWhatsappInstanceId(data.whatsappInstanceId || '');
      }
    } catch {}
  };

  useEffect(() => {
    fetchBinding();
    fetchSettings();
  }, []);

  // Helper to extract spreadsheet ID in UI
  const getCleanSpreadsheetId = (input: string) => {
    if (!input) return '';
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim().split('/')[0];
  };

  // Handle JSON file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processJsonText(text);
    };
    reader.readAsText(file);
  };

  const processJsonText = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed.client_email || !parsed.private_key) {
        toast({
          title: 'ملف غير مكتمل',
          description: 'ملف JSON يجب أن يحتوي على client_email و private_key.',
          variant: 'destructive',
        });
        return;
      }
      setJsonContent(text);
      setExtractedEmail(parsed.client_email);
      toast({
        title: 'تم التحقق من الملف',
        description: `تم استخراج البريد البرمجي بنجاح: ${parsed.client_email}`,
      });
      setCurrentStep(5); // Advance to share step
    } catch {
      toast({
        title: 'صيغة خاطئة',
        description: 'الملف ليس بصيغة JSON صحيحة.',
        variant: 'destructive',
      });
    }
  };

  const copyEmail = () => {
    if (!extractedEmail) return;
    navigator.clipboard.writeText(extractedEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ البريد البرمجي إلى الحافظة.',
    });
  };

  const handleRunTest = async () => {
    const spreadsheetId = getCleanSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال رابط أو معرف Google Sheet.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/google-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_account_json: jsonContent || undefined,
          spreadsheet_url_or_id: spreadsheetId,
          sheet_name: sheetName || 'Sessions',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTestResult({
          success: false,
          message: data.error || 'فشل الاتصال بجدول البيانات.',
        });
        toast({
          title: 'فشل الاختبار',
          description: data.error || 'فشل الاتصال بالجدول.',
          variant: 'destructive',
        });
      } else {
        setTestResult({
          success: true,
          message: data.message,
          sheet_title: data.sheet_title,
        });
        toast({
          title: 'اتصال ناجح! ✓',
          description: 'تم الاتصال بالجدول وقراءة ورقة العمل بنجاح.',
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'تعذر إجراء الاختبار بسبب انقطاع الاتصال بالخادم.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveBinding = async () => {
    const spreadsheetId = getCleanSpreadsheetId(sheetInput);
    if (!jsonContent || !spreadsheetId) return;

    setIsSavingBinding(true);
    try {
      const res = await fetch('/api/settings/google-bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_account_json: jsonContent,
          spreadsheet_url_or_id: spreadsheetId,
          sheet_name: sheetName || 'Sessions',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الربط.');

      toast({
        title: 'تم الربط بنجاح! 🎉',
        description: 'تم تشفير وحفظ إعدادات Google Sheet للمكتب بنجاح.',
      });
      setShowWizard(false);
      fetchBinding();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingBinding(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('تحذير: هل أنت متأكد من رغبتك في قطع ربط Google Sheet؟ ستتوقف مزامنة الجلسات والتقارير مؤقتاً لجميع أعضاء مكتبك.')) {
      return;
    }

    try {
      const res = await fetch('/api/settings/google-disconnect', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('فشل قطع الربط.');
      toast({
        title: 'تم قطع الربط',
        description: 'تم إزالة ربط Google Sheet بنجاح.',
      });
      setShowWizard(true);
      setCurrentStep(1);
      fetchBinding();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleSaveWhatsapp = async () => {
    setIsSavingWhatsapp(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber,
          whatsappApiUrl,
          whatsappToken,
          whatsappInstanceId,
        }),
      });
      if (!res.ok) throw new Error('فشل حفظ إعدادات الواتساب.');
      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث إعدادات تنبيهات الواتساب بنجاح.',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setIsTestingWhatsapp(true);
    try {
      const res = await fetch('/api/settings/test-whatsapp', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إجراء تجربة الواتساب.');
      toast({
        title: 'تم الإرسال بنجاح',
        description: data.message || 'تم إرسال رسالة تجريبية إلى رقمك بنجاح!',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 font-sans" dir="rtl">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                إعدادات المكتب وتصدير Google Sheet (اختياري)
              </h1>
              <Badge variant="outline" className="text-xs font-bold">
                {currentUser?.officeName || 'إدارة المكتب'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              قاعدة بيانات المكتب مؤمنة ومعزولة على Supabase Postgres. يمكنك ربط Google Sheets كنسخة احتياطية وتصدير البيانات بضغطة زر.
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl self-end sm:self-center">
          <button
            onClick={() => setActiveTab('google')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'google'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ربط Google Sheet
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'whatsapp'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            تنبيهات الواتساب
          </button>
        </div>
      </div>

      {/* Tab 1: Google Sheet Binding */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          {/* Status Banner when already connected */}
          {binding?.is_connected && !showWizard && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground">
                        جدول Google Sheets مربوط كوجهة تصدير للمكتب
                      </h2>
                      <Badge className="bg-emerald-600 text-white text-[10px]">جاهز للتصدير ✓</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      بياناتك القضائية محفوظة بأمان في قاعدة بيانات Supabase Postgres. يمكنك تصدير نسخة احتياطية إلى Google Sheets بنقرة واحدة.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    disabled={isExporting}
                    onClick={handleExportToSheets}
                    className="text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isExporting ? 'جارٍ التصدير...' : 'تصدير البيانات إلى الشيت الآن'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSheetInput(binding.spreadsheet_id || '');
                      setSheetName(binding.sheet_name || 'Sessions');
                      setExtractedEmail(binding.client_email || '');
                      setShowWizard(true);
                      setCurrentStep(6);
                    }}
                    className="text-xs gap-1.5 font-bold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    تعديل الرابط / اختبار
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    قطع الربط
                  </Button>
                </div>
              </div>

              {/* Connected Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-emerald-500/15">
                <div>
                  <span className="text-muted-foreground block text-[11px]">معرف الجدول (Spreadsheet ID):</span>
                  <span className="font-mono font-bold text-foreground truncate block max-w-xs mt-0.5">
                    {binding.spreadsheet_id}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">البريد البرمجي للمكتب:</span>
                  <span className="font-mono font-bold text-foreground truncate block max-w-xs mt-0.5">
                    {binding.client_email || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">ورقة العمل المستهدفة:</span>
                  <span className="font-bold text-foreground block mt-0.5">{binding.sheet_name || 'Sessions'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Wizard View */}
          {(showWizard || !binding?.is_connected) && (
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
              {/* Stepper Header Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    معالج ربط Google Sheet لمكتبك (خطوة {currentStep} من {WIZARD_STEPS.length})
                  </h2>

                  {binding?.is_connected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowWizard(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      إلغاء والعودة للحالة الحالية
                    </Button>
                  )}
                </div>

                {/* Horizontal Stepper Progress Bar */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2">
                  {WIZARD_STEPS.map((step) => {
                    const isPassed = step.id < currentStep;
                    const isCurrent = step.id === currentStep;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          if (step.id <= currentStep || (jsonContent && step.id <= 6)) {
                            setCurrentStep(step.id);
                          }
                        }}
                        className={`text-right group flex flex-col items-center sm:items-start p-1.5 sm:p-2 rounded-xl transition-all ${
                          isCurrent
                            ? 'bg-primary/10 border-b-2 border-primary text-primary font-bold'
                            : isPassed
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-muted-foreground opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCurrent
                                ? 'bg-primary text-primary-foreground'
                                : isPassed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isPassed ? '✓' : step.id}
                          </span>
                          <span className="hidden sm:inline text-xs truncate">{step.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step Contents */}
              <div className="bg-muted/30 border border-border rounded-xl p-5 sm:p-6 min-h-[300px] flex flex-col justify-between">
                {/* Step 1: Introduction */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        مرحباً بك في معالج ربط Google Sheet لمكتبك
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        يتيح هذا المعالج ربط حساب مكتبك بجدول Google Sheets خاص بك بالكامل، بحيث تُحفظ جميع جلسات المحكمة، الأحكام القضائية، الوكالات الشرعية، والمهام في ورقة إكسل تملكها أنت حصراً، دون مشاركتها مع أي مكتب آخر.
                      </p>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-xl space-y-2 text-xs">
                      <p className="font-bold text-foreground">المتطلبات قبل البدء:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>حساب Google نشط (Gmail أو Google Workspace).</li>
                        <li>صلاحية لإنشاء مشروع في Google Cloud Console (مجاني بالكامل).</li>
                        <li>5 إلى 7 دقائق لإتمام الخطوات لمرة واحدة فقط.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Step 2: Google Cloud & API */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 2: تفعيل Google Sheets API في Google Cloud
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        نحتاج إلى تفعيل واجهة Google Sheets API في منصة المطورين للسماح للنظام بقراءة وتحديث بيانات الجلسات.
                      </p>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-xl space-y-3 text-xs">
                      <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
                        <li>افتح منصة Google Cloud Console عبر الزر أدناه.</li>
                        <li>اختر أو أنشئ مشروعاً جديداً باسم مكتبك (مثلاً: <code>Law-Office-Sheet</code>).</li>
                        <li>اضغط على زر <strong>تفعيل (Enable)</strong> لواجهة Google Sheets API.</li>
                      </ol>

                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              'https://console.cloud.google.com/apis/library/sheets.googleapis.com',
                              '_blank',
                            )
                          }
                          className="gap-2 text-xs font-bold text-primary border-primary/30"
                        >
                          <ExternalLink className="w-4 h-4" />
                          فتح Google Cloud Console في تبويب جديد
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Create Service Account */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 3: إنشاء حساب خدمة (Service Account) وتحميل مفتاح JSON
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        حساب الخدمة هو بريد آلي آمن يمثل النظام ويتعامل مع جدولك نيابة عن مكتبك.
                      </p>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-xl space-y-3 text-xs">
                      <ol className="list-decimal list-inside space-y-2 text-foreground font-medium">
                        <li>
                          من القائمة الجانبية في Google Cloud، اذهب إلى <strong>APIs & Services &gt; Credentials</strong>.
                        </li>
                        <li>
                          اضغط على <strong>Create Credentials</strong> ثم اختر <strong>Service Account</strong>.
                        </li>
                        <li>
                          أدخل اسماً لحساب الخدمة (مثل: <code>court-sync</code>) واضغط <strong>Done</strong>.
                        </li>
                        <li>
                          اضغط على حساب الخدمة المنشأ، ثم انتقل لتبويب <strong>Keys</strong>.
                        </li>
                        <li>
                          اضغط على <strong>Add Key &gt; Create new key</strong> واختر نوع <strong>JSON</strong>، ثم حمّل الملف لجهازك.
                        </li>
                      </ol>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                      <p>
                        <strong>تنبيه أمان:</strong> ملف المفتاح بصيغة JSON سرّي للغاية ويجب عدم مشاركته مع أي شخص. سيتم تشفيره بأعلى معايير التشفير (AES-256-GCM) فور رفعه.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 4: Upload JSON Key */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 4: رفع ملف Service Account JSON
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        قم بسحب ملف JSON الذي قمت بتحميله في الخطوة السابقة أو اختره من جهازك للتحقق واستخراج البريد البرمجي.
                      </p>
                    </div>

                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3 bg-card hover:bg-accent/40 transition-colors">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">اختر ملف المفتاح بصيغة JSON من جهازك</p>
                        <p className="text-[11px] text-muted-foreground">أو اسحب الملف وأفلته هنا</p>
                      </div>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileUpload}
                        className="text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">أو الصق محتوى الملف نصياً هنا:</Label>
                      <Textarea
                        placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                        value={jsonContent}
                        onChange={(e) => processJsonText(e.target.value)}
                        className="text-xs font-mono h-24"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Share Google Sheet */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 5: مشاركة Google Sheet مع البريد البرمجي للمكتب
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        للسماح للنظام بقراءة وتعديل الجلسات، يجب مشاركة جدول البيانات مع البريد البرمجي أدناه بصلاحية <strong>محرر (Editor)</strong>.
                      </p>
                    </div>

                    {/* Extracted Email Copy Card */}
                    <div className="bg-primary/10 border border-primary/25 p-4 rounded-xl space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        البريد البرمجي الخاص بمكتبك (Client Email):
                      </span>
                      <div className="flex items-center justify-between gap-2 bg-background p-2.5 rounded-lg border border-border" dir="ltr">
                        <span className="font-mono text-xs font-bold text-foreground truncate select-all">
                          {extractedEmail || 'لم يتم استخراج البريد بعد'}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={copyEmail}
                          className="h-8 gap-1.5 text-xs font-bold shrink-0"
                        >
                          {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedEmail ? 'تم النسخ!' : 'نسخ البريد'}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-xl space-y-2 text-xs">
                      <p className="font-bold text-foreground">طريقة المشاركة في Google Sheets:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                        <li>افتح جدول البيانات الخاص بمكتبك على Google Sheets.</li>
                        <li>اضغط على زر <strong>مشاركة (Share)</strong> في الزاوية العلوية.</li>
                        <li>الصق البريد البرمجي المنسوخ أعلاه في خانة إضافة أشخاص.</li>
                        <li>
                          تأكد من اختيار الدور <strong>محرر (Editor)</strong>، ثم اضغط <strong>مشاركة / إرسال</strong>.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Step 6: Enter Spreadsheet ID or URL */}
                {currentStep === 6 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 6: إدخال رابط أو معرف Google Sheet
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        الصق الرابط الكامل لجدول البيانات من المتصفح، وسيقوم النظام باستخراج المعرف (ID) تلقائياً.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">رابط جدول البيانات الكامل أو المعرف (ID) *</Label>
                        <Input
                          placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                          value={sheetInput}
                          onChange={(e) => setSheetInput(e.target.value)}
                          className="text-xs h-10 font-mono"
                          dir="ltr"
                        />
                      </div>

                      {/* Realtime Extracted ID Preview */}
                      {getCleanSpreadsheetId(sheetInput) && (
                        <div className="p-2.5 rounded-lg bg-card border border-border text-xs flex items-center justify-between">
                          <span className="text-muted-foreground">المعرف المستخرج:</span>
                          <span className="font-mono font-bold text-primary" dir="ltr">
                            {getCleanSpreadsheetId(sheetInput)}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs font-bold">اسم ورقة العمل (الافتراضي: Sessions)</Label>
                        <Input
                          placeholder="Sessions"
                          value={sheetName}
                          onChange={(e) => setSheetName(e.target.value)}
                          className="text-xs h-9"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          إذا لم تكن الورقة موجودة، فسيقوم النظام بإنشائها وتجهيز أعمدة الجلسات تلقائياً.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 7: Test Connection & Save */}
                {currentStep === 7 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-foreground">
                        الخطوة 7: اختبار الاتصال وتأكيد الربط
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        يقوم هذا الفحص بإجراء تجربة حقيقية للاتصال بجدول مكتبك والتحقق من الصلاحيات قبل الحفظ.
                      </p>
                    </div>

                    {/* Test Button & Status */}
                    <div className="space-y-3">
                      <Button
                        type="button"
                        onClick={handleRunTest}
                        disabled={isTesting}
                        className="w-full gap-2 text-xs font-bold h-11"
                      >
                        {isTesting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            <span>جارٍ فحص الاتصال بالجدول...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            <span>بدء فحص واختبار الاتصال الآن ⚡</span>
                          </>
                        )}
                      </Button>

                      {/* Test Outcome Box */}
                      {testResult && (
                        <div
                          className={`p-4 rounded-xl border text-xs space-y-2 ${
                            testResult.success
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                              : 'bg-destructive/10 border-destructive/30 text-destructive'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold text-sm">
                            {testResult.success ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <span>نجح الاتصال بجدول البيانات!</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-5 h-5 text-destructive" />
                                <span>تعذر الاتصال بجدول البيانات</span>
                              </>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed">{testResult.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stepper Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentStep === 1}
                    onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                    className="gap-1.5 text-xs font-bold"
                  >
                    <ArrowRight className="w-4 h-4" />
                    السابق
                  </Button>

                  {currentStep < 7 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (currentStep === 4 && !jsonContent) {
                          toast({
                            title: 'تنبيه',
                            description: 'يرجى رفع أو لصق ملف المفتاح للمتابعة.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        if (currentStep === 6 && !getCleanSpreadsheetId(sheetInput)) {
                          toast({
                            title: 'تنبيه',
                            description: 'يرجى إدخال رابط أو معرف جدول البيانات.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setCurrentStep((prev) => Math.min(7, prev + 1));
                      }}
                      className="gap-1.5 text-xs font-bold"
                    >
                      التالي
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!testResult?.success || isSavingBinding}
                      onClick={handleSaveBinding}
                      className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isSavingBinding ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          <span>جارٍ التشفير والحفظ...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>حفظ وتفعيل الربط للمكتب ✓</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: WhatsApp Notification Channel */}
      {activeTab === 'whatsapp' && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">إعدادات تنبيهات جلسات الواتساب</h2>
              <p className="text-xs text-muted-foreground">
                إرسال تذكيرات آلية بالمواعيد والجلسات لموكلي ومحامي مكتبك قبل 24 ساعة و6 ساعات
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold">رقم الواتساب المرسل أو المستلم للتجربة *</Label>
              <Input
                placeholder="9665XXXXXXXX أو 9627XXXXXXXX"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="text-xs h-9 font-mono"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">رابط مزود خدمة الواتساب (API URL)</Label>
              <Input
                placeholder="https://api.ultramsg.com أو خادم محلي"
                value={whatsappApiUrl}
                onChange={(e) => setWhatsappApiUrl(e.target.value)}
                className="text-xs h-9 font-mono"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">معرف النسخة (Instance ID)</Label>
              <Input
                placeholder="instance12345"
                value={whatsappInstanceId}
                onChange={(e) => setWhatsappInstanceId(e.target.value)}
                className="text-xs h-9 font-mono"
                dir="ltr"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">رمز المصادقة (Token / Secret)</Label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                className="text-xs h-9 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTestingWhatsapp}
              onClick={handleTestWhatsapp}
              className="w-full sm:w-auto gap-2 text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال تنبيه تجريبي الآن</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSavingWhatsapp}
              onClick={handleSaveWhatsapp}
              className="w-full sm:w-auto gap-2 text-xs font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>حفظ إعدادات الواتساب</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
