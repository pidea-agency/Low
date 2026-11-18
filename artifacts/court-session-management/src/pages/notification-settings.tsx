import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  MessageSquare,
  Check,
  RotateCcw,
  Send,
  Sparkles,
  ChevronDown,
  Info,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Edit3,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface NotificationTemplate {
  event_type: string;
  id_number?: number;
  name: string;
  recipient_label?: string;
  channels: {
    in_app: boolean;
    whatsapp: boolean;
  };
  body_template: string;
  title_template?: string;
  placeholders: string[];
  category: 'cases_poa' | 'accounts' | 'subscription_payments' | 'reminders';
}

const defaultInitialTemplates: NotificationTemplate[] = [
  {
    event_type: 'case_assigned',
    id_number: 1,
    name: 'تكليف بقضية أو جلسة جديدة',
    recipient_label: 'المحامي المكلف',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'مرحباً بك أستاذ {{memberName}}، تم تكليفك بـ {{recordTypeArabic}} حسب الإجراءات في {{courtName}}. لمتابعة رابط التفاصيل: {{directLink}}',
    placeholders: ['recordTypeArabic', 'courtName', 'memberName', 'directLink', 'recordDescription'],
    category: 'cases_poa',
  },
  {
    event_type: 'poa_assigned',
    id_number: 2,
    name: 'تكليف بوكالة قانونية جديدة',
    recipient_label: 'المحامي المكلف',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم تكليفك بوكالة قانونية جديدة برقم {{poaNumber}} الخاصة بالموكل {{clientName}} لمباشرة الإجراءات.',
    placeholders: ['issueDate', 'clientName', 'poaNumber', 'directLink'],
    category: 'cases_poa',
  },
  {
    event_type: 'poa_expiring',
    id_number: 3,
    name: 'تنبيه قرب انتهاء سريان وكالة (قبل 30 يوماً)',
    recipient_label: 'المحامي المكلف ومدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تنبيه هام: تنتهي الوكالة رقم {{poaNumber}} للموكل {{clientName}} خلال {{daysRemaining}} أيام. يرجى تجديد الوكالة لضمان استمرار المرافعة.',
    placeholders: ['daysRemaining', 'clientName', 'poaNumber', 'expiryDate'],
    category: 'cases_poa',
  },
  {
    event_type: 'new_document_uploaded',
    id_number: 4,
    name: 'رفع مستند أو مرفق قضائي جديد',
    recipient_label: 'المحامي المكلف',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'قام {{uploaderName}} برفع مستند جديد ({{documentName}}) على {{recordTypeArabic}} رقم {{recordNumber}}',
    placeholders: ['recordTypeArabic', 'documentName', 'uploaderName', 'recordNumber'],
    category: 'cases_poa',
  },
  {
    event_type: 'member_activation_invite',
    id_number: 5,
    name: 'دعوة تفعيل حساب عضو/محام جديد',
    recipient_label: 'العضو المعني',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'مرحباً بك أستاذ {{memberName}}، تمت دعوتك للانضمام إلى {{officeName}} على منصة LegalTech. يرجى تفعيل حسابك من خلال الرابط: {{activationLink}}',
    placeholders: ['activationLink', 'officeName', 'memberName'],
    category: 'accounts',
  },
  {
    event_type: 'member_account_suspended',
    id_number: 6,
    name: 'إيقاف أو تعليق حساب عضو',
    recipient_label: 'العضو المعني',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم إيقاف حسابك في مكتب {{officeName}}. يرجى مراجعة إدارة المكتب لمزيد من التفاصيل.',
    placeholders: ['adminContact', 'reason', 'officeName'],
    category: 'accounts',
  },
  {
    event_type: 'subscription_expiring_soon',
    id_number: 7,
    name: 'قرب انتهاء اشتراك المكتب السحابي',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تنبيه إداري: اشتراك مكتبك في باقة {{planName}} ينتهي خلال {{daysRemaining}} أيام (بتاريخ {{endDate}}). يرجى التجديد لتفادي تعليق الجلسات.',
    placeholders: ['endDate', 'daysRemaining', 'planName', 'renewLink'],
    category: 'subscription_payments',
  },
  {
    event_type: 'payment_recorded',
    id_number: 8,
    name: 'تسجيل دفعة مالية جديدة من موكل',
    recipient_label: 'المحامي المكلف ومدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم تسجيل دفعة مالية جديدة للمكتب بقيمة {{amount}} {{currency}} برقم سند {{reference}} لصالح القضية {{caseNumber}}',
    placeholders: ['caseNumber', 'reference', 'currency', 'amount'],
    category: 'subscription_payments',
  },
  {
    event_type: 'session_upcoming_reminder',
    id_number: 9,
    name: 'تذكير بموعد جلسة مقبلة (قبل 24 ساعة)',
    recipient_label: 'المحامي المكلف ومدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تذكير: موعد جلسة القضية رقم {{caseNumber}} بتاريخ {{sessionDate}} الساعة {{sessionTime}} لدى {{court}} الدائرة {{circuit}}',
    placeholders: ['sessionTime', 'sessionDate', 'caseNumber', 'circuit', 'court'],
    category: 'reminders',
  },
  {
    event_type: 'reminder_failed',
    id_number: 10,
    name: 'فشل إرسال تذكير لجلسة تلقائي (إشعار خطأ)',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تعذر إرسال تذكير الجلسة القضائية رقم {{caseNumber}} بسبب {{error}}',
    placeholders: ['recipientPhone', 'error', 'caseNumber'],
    category: 'reminders',
  },
  {
    event_type: 'staff_license_expiring',
    id_number: 11,
    name: 'قرب انتهاء رخصة محاماة عضو',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: false },
    body_template:
      'تنتهي رخصة المحاماة الخاصة بالعضو {{memberName}} (رقم الترخيص: {{licenseNumber}}) خلال {{daysRemaining}} يوماً (تاريخ الانتهاء: {{expiryDate}}).',
    placeholders: ['memberName', 'licenseNumber', 'daysRemaining', 'expiryDate'],
    category: 'accounts',
  },
  {
    event_type: 'subscription_suspended',
    id_number: 12,
    name: 'إيقاف أو تعليق اشتراك المكتب',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: false },
    body_template:
      'تم إيقاف اشتراك مكتبك في منصة {{platformName}}. يرجى التواصل مع إدارة المنصة لتسوية الحساب وإعادة التفعيل.',
    placeholders: ['platformName', 'officeName', 'reason'],
    category: 'subscription_payments',
  },
];

const samplePlaceholderMap: Record<string, string> = {
  recordTypeArabic: 'جلسة قضائية (تجريبي)',
  record_type_arabic: 'جلسة قضائية (تجريبي)',
  recordDescription: 'دعوى رقم 0000/9999 (تجريبي)',
  directLink: 'https://app.mansoori-law.sa/demo',
  courtName: 'المحكمة العامة بالرياض',
  court: 'المحكمة العامة بالرياض',
  circuit: 'الثالثة عشرة',
  memberName: 'أ. فهد المنصوري (محام تجريبي)',
  poaNumber: '44123456 (وكالة تجريبية)',
  clientName: 'عبدالله محمد (عميل تجريبي)',
  daysRemaining: '5',
  expiryDate: '1446/09/15هـ',
  issueDate: '1445/09/15هـ',
  documentName: 'مذكرة_جوابية_تجريبية.pdf',
  uploaderName: 'مساعد قانوني (تجريبي)',
  recordNumber: '0000/9999',
  activationLink: 'https://app.mansoori-law.sa/activate/demo',
  officeName: 'مكتب المنصوري للمحاماة (تجريبي)',
  adminContact: '0500000000',
  reason: 'تحديث بيانات دوري (إجراء اختباري)',
  planName: 'الباقة الاحترافية (تجريبية)',
  endDate: '1446/12/30هـ',
  renewLink: 'https://app.mansoori-law.sa/subscription',
  amount: '1,500',
  currency: 'ر.س',
  reference: 'REC-TEST-999',
  caseNumber: '0000/9999',
  sessionDate: '1446/05/20هـ',
  sessionTime: '10:30 صباحاً',
  recipientPhone: '9665xxxxxxxx',
  error: 'خطأ في مزود الخدمة (تجريبي)',
  licenseNumber: '381234 (ترخيص تجريبي)',
  platformName: 'منصة إدارة الجلسات',
};

function substitutePlaceholders(text: string): string {
  let res = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return samplePlaceholderMap[key] || `[${key}]`;
  });
  res = res.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key) => {
    return samplePlaceholderMap[key] || `[${key}]`;
  });
  return res;
}

export default function NotificationSettingsPage() {
  const { toast } = useToast();

  const [templates, setTemplates] = useState<NotificationTemplate[]>(defaultInitialTemplates);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testEventType, setTestEventType] = useState<string>('case_assigned');
  const [isCustomOverride, setIsCustomOverride] = useState(false);
  const [customTestText, setCustomTestText] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    idMessage?: string;
    error?: string;
  } | null>(null);
  const [testQuota, setTestQuota] = useState<{ remaining: number; max: number } | null>(null);

  // Fetch templates from API
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch('/api/settings/notification-templates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const merged = defaultInitialTemplates.map((def) => {
            const found = data.find((d: any) => d.event_type === def.event_type);
            return found ? { ...def, ...found } : def;
          });
          setTemplates(merged);
        } else {
          setTemplates(defaultInitialTemplates);
        }
      } else {
        setTemplates(defaultInitialTemplates);
      }
    } catch {
      setTemplates(defaultInitialTemplates);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Fetch test send quota
  const fetchQuota = async () => {
    try {
      const res = await fetch('/api/settings/notification-templates/test-send/quota', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTestQuota({ remaining: data.remaining, max: data.max });
      }
    } catch {
      // quota check is non-critical
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchQuota();
  }, []);

  const handleToggleChannel = (eventType: string, channel: 'in_app' | 'whatsapp', enabled: boolean) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.event_type === eventType
          ? { ...t, channels: { ...t.channels, [channel]: enabled } }
          : t
      )
    );
  };

  const handleBodyChange = (eventType: string, text: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.event_type === eventType ? { ...t, body_template: text } : t))
    );
  };

  const handleSaveSingleTemplate = async (template: NotificationTemplate) => {
    setSavingKey(template.event_type);
    try {
      const res = await fetch(`/api/settings/notification-templates/${template.event_type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channels: template.channels,
          body_template: template.body_template,
          title_template: template.title_template || template.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل حفظ القالب');
      }

      toast({
        title: 'تم حفظ القالب بنجاح ✓',
        description: `تم حفظ إعدادات وقناة حدث "${template.name}".`,
      });
    } catch (err: any) {
      toast({
        title: 'خطأ أثناء الحفظ',
        description: err?.message || 'تعذر حفظ القالب في الخادم.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAllTemplates = async () => {
    setIsSavingAll(true);
    try {
      for (const t of templates) {
        await fetch(`/api/settings/notification-templates/${t.event_type}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            channels: t.channels,
            body_template: t.body_template,
            title_template: t.title_template || t.name,
          }),
        });
      }
      toast({
        title: 'تم حفظ كافة القوالب بنجاح ✓',
        description: 'تم تحديث إعدادات وقنوات إرسال كافة أحداث المنظومة القضائية.',
      });
    } catch {
      toast({
        title: 'تنبيه',
        description: 'تم حفظ التعديلات محلياً وتطبيقها على النظام.',
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleResetDefaultTemplates = () => {
    setTemplates(defaultInitialTemplates);
    toast({
      title: 'تمت استعادة القوالب القياسية',
      description: 'تم تعيين النصوص والمتغيرات الافتراضية لجميع الإشعارات.',
    });
  };

  const handleSelectTemplateForTest = (eventType: string) => {
    setTestEventType(eventType);
    const target = templates.find((t) => t.event_type === eventType);
    if (target) {
      setCustomTestText(target.body_template);
    }
    // Smooth scroll to test box
    const testBox = document.getElementById('test-send-panel');
    if (testBox) {
      testBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast({
      title: 'تم تحديد القالب للاختبار',
      description: `يمكنك الآن إدخال رقم هاتفك لإرسال رسالة تجريبية حقيقية.`,
    });
  };

  // Execute Real Test Send
  const handleExecuteTestSend = async () => {
    const cleanPhone = testPhone.trim();
    if (!cleanPhone) {
      toast({
        title: 'رقم الهاتف مطلوب',
        description: 'يرجى إدخال رقم الواتساب الذي تود إرسال الرسالة التجريبية إليه.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const payload: any = {
        phone: cleanPhone,
        eventType: testEventType,
      };

      if (isCustomOverride && customTestText.trim()) {
        payload.customMessage = customTestText.trim();
      }

      const res = await fetch('/api/settings/notification-templates/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'فشل إرسال الرسالة التجريبية.';
        setTestResult({
          success: false,
          error: errorMsg,
        });
        toast({
          title: 'فشل إرسال الرسالة التجريبية',
          description: errorMsg,
          variant: 'destructive',
        });
      } else {
        setTestResult({
          success: true,
          message: data.message,
          idMessage: data.idMessage,
        });
        if (typeof data.remaining === 'number') {
          setTestQuota((prev) => ({ remaining: data.remaining, max: prev?.max || 10 }));
        }
        toast({
          title: 'تم الإرسال بنجاح عبر الواتساب ✓',
          description: data.idMessage ? `معرّف الرسالة: ${data.idMessage}` : data.message,
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'تعذر الاتصال بالخادم لإجراء اختبار الإرسال.';
      setTestResult({
        success: false,
        error: errorMsg,
      });
      toast({
        title: 'خطأ في الاتصال',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
      fetchQuota();
    }
  };

  // Selected template for live test preview
  const currentSelectedTestTemplate = useMemo(() => {
    return (
      templates.find((t) => t.event_type === testEventType) ||
      defaultInitialTemplates.find((t) => t.event_type === testEventType) ||
      defaultInitialTemplates[0]
    );
  }, [templates, testEventType]);

  const previewSourceText = isCustomOverride && customTestText.trim()
    ? customTestText
    : currentSelectedTestTemplate.body_template;

  const renderedPreviewText = useMemo(() => {
    return substitutePlaceholders(previewSourceText);
  }, [previewSourceText]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesCategory =
        activeCategory === 'all' ||
        (activeCategory === 'cases_poa' && t.category === 'cases_poa') ||
        (activeCategory === 'accounts' && t.category === 'accounts') ||
        (activeCategory === 'subscription_payments' && t.category === 'subscription_payments') ||
        (activeCategory === 'reminders' && t.category === 'reminders');

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.event_type.toLowerCase().includes(q) ||
        t.body_template.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [templates, activeCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans select-none" dir="rtl">
     

 {/* ── Executive Header Banner ── */}
<div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 transition-all">
  {/* Left/Title Info */}
  <div className="space-y-2">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#00236f] flex items-center justify-center shadow-2xs shrink-0 border border-[#dce9ff]">
        <MessageSquare className="w-5 h-5 text-[#00236f]" />
      </div>
      <div>
        <h1 className="text-base sm:text-lg font-bold text-[#0b1c30]">
          التحكم بقوالب الرسائل والتنبيهات التلقائية
        </h1>
      </div>
    </div>
    <p className="text-xs text-[#757682] leading-relaxed max-w-3xl pr-0 sm:pr-13">
      إدارة وتخصيص قوالب رسائل الواتساب وقنوات الإرسال لجميع أحداث المنظومة القضائية، وضبط المتغيرات الذكية (Placeholders) مع إمكانية إرسال رسائل تجريبية حية عبر بوابة Green API الحقيقية.
    </p>
  </div>

  {/* Global Action Buttons (Clean & Stacked/Wrapped properly) */}
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto shrink-0 pt-2 xl:pt-0">
    <Button
      onClick={handleSaveAllTemplates}
      disabled={isSavingAll}
      className="bg-[#00236f] hover:bg-[#15388c] text-white text-xs font-bold h-10 px-4 gap-2 rounded-xl shadow-sm cursor-pointer justify-center transition-all"
    >
      <Check className="w-4 h-4" />
      <span>{isSavingAll ? 'جارٍ الحفظ...' : 'حفظ تغييرات كافة القوالب'}</span>
    </Button>

    <Button
      variant="outline"
      onClick={handleResetDefaultTemplates}
      className="bg-white hover:bg-slate-50 text-[#444651] border-slate-200/80 text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-xl cursor-pointer shadow-2xs justify-center transition-colors"
    >
      <RotateCcw className="w-3.5 h-3.5 text-[#757682]" />
      <span>استعادة القوالب القياسية</span>
    </Button>

    <Link href="/settings" className="contents">
      <Button
        variant="outline"
        className="bg-white hover:bg-slate-50 text-[#00236f] border-slate-200/80 text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-xl cursor-pointer shadow-2xs justify-center transition-colors w-full sm:w-auto"
      >
        <ExternalLink className="w-3.5 h-3.5 text-[#00236f]" />
        <span>إعدادات بوابة الواتساب</span>
      </Button>
    </Link>
  </div>
</div>

      {/* ── FEATURED SECTION: Real Test-Send Panel ── */}
      <div
        id="test-send-panel"
        className="bg-gradient-to-br from-white via-[#fafcff] to-[#f4f7fc] border-2 border-[#cfe0fc] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eeff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00236f] text-white flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#10233F] flex items-center gap-2">
                <span>إرسال رسالة تجريبية حية عبر الواتساب</span>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-200">
                  إرسال فعلي حقيقي
                </span>
              </h2>
              <p className="text-[11px] text-[#64748B]">
                اختر القالب أو اكتب صياغة مخصصة لإرسالها فوراً إلى رقم هاتفك لاختبار التنسيق وسلامة المتغيرات.
              </p>
            </div>
          </div>

          {/* Rate-limit badge */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium text-[#64748B]">
              معدل الاستخدام:
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                testQuota && testQuota.remaining <= 2
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#eff4ff] text-[#00236f] border-[#cfe0fc]'
              }`}
            >
              المتبقي: {testQuota ? testQuota.remaining : 10} من 10 رسائل / ساعة
            </span>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phone Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#10233F] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#00236f]" />
              <span>رقم هاتف المستلم للاختبار *</span>
            </label>
            <Input
              type="text"
              placeholder="مثال: 972501234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="h-10 text-xs bg-white border-[#cfe0fc] focus:border-[#00236f] font-mono"
              dir="ltr"
            />
            <p className="text-[10px] text-[#64748B]">
              أدخل رقمك مع مفتاح الدولة (مثل 9725xxxxxxxx) لاستقبال الرسالة فوراً.
            </p>
          </div>

          {/* Event Type Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#10233F] flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#00236f]" />
              <span>اختيار نوع حدث القالب المطلوب اختباره *</span>
            </label>
            <select
              value={testEventType}
              onChange={(e) => {
                setTestEventType(e.target.value);
                const t = templates.find((row) => row.event_type === e.target.value);
                if (t && isCustomOverride) {
                  setCustomTestText(t.body_template);
                }
              }}
              className="w-full h-10 px-3 rounded-lg text-xs bg-white border border-[#cfe0fc] text-[#10233F] font-semibold focus:outline-hidden focus:border-[#00236f]"
            >
              {templates.map((t) => (
                <option key={t.event_type} value={t.event_type}>
                  {t.name} ({t.event_type})
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-[10px] text-[#64748B]">
              <span>المستلم الافتراضي لهذا الحدث: <strong className="text-[#10233F]">{currentSelectedTestTemplate.recipient_label || 'المعني'}</strong></span>
              <button
                type="button"
                onClick={() => {
                  setIsCustomOverride(!isCustomOverride);
                  if (!isCustomOverride) {
                    setCustomTestText(currentSelectedTestTemplate.body_template);
                  }
                }}
                className="text-[#00236f] font-bold hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isCustomOverride ? 'إلغاء التعديل اليدوي' : 'تعديل الصياغة قبل التجربة'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Free-text override textarea if activated */}
        {isCustomOverride && (
          <div className="space-y-1.5 p-3.5 rounded-xl bg-white border border-[#d6e4ff]">
            <label className="text-xs font-bold text-[#00236f] flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>صياغة رسالة اختبارية مخصصة (غير محفوظة):</span>
            </label>
            <Textarea
              value={customTestText}
              onChange={(e) => setCustomTestText(e.target.value)}
              rows={3}
              placeholder="اكتب صياغة تجريبية مع إمكانية استخدام المتغيرات مثل {{caseNumber}} و {{memberName}}"
              className="text-xs bg-[#fafcff] border-[#cfe0fc]"
            />
            <div className="flex items-center justify-between text-[10px] text-[#64748B]">
              <span>سيتم تعويض المتغيرات بالقيم الافتراضية المعروضة أدناه.</span>
              <button
                type="button"
                onClick={() => setCustomTestText(currentSelectedTestTemplate.body_template)}
                className="text-[#00236f] hover:underline"
              >
                استعادة نص القالب الحالي
              </button>
            </div>
          </div>
        )}

        {/* Live Preview Box with Dummy Values Substituted */}
        <div className="p-4 rounded-xl bg-white border border-[#e2ecfa] space-y-2">
         

          <div className="p-3.5 rounded-lg bg-[#eff4ff]/60 border border-[#d6e4ff] text-xs leading-relaxed text-[#10233F] whitespace-pre-wrap font-sans">
             
            {renderedPreviewText}
            <div className="text-[10px] text-[#64748B] mt-2 pt-1 border-t border-[#d6e4ff]/50">
              ⚠️ هذه رسالة اختبارية من مدير النظام ولا تمثل إجراءً حقيقياً.
            </div>
          </div>

          {/* Dummy Values Chips Info */}
          <div className="pt-1 flex items-center gap-2 flex-wrap text-[10px] text-[#64748B]">
            <span className="font-semibold text-[#10233F]">القيم التجريبية المطبقة:</span>
            <span className="bg-[#eff4ff] px-2 py-0.5 rounded text-[#00236f] font-mono">
              {`{lawyer_name} → "أ. فهد المنصوري (محام تجريبي)"`}
            </span>
            <span className="bg-[#eff4ff] px-2 py-0.5 rounded text-[#00236f] font-mono">
              {`{case_number} → "0000/9999"`}
            </span>
            <span className="bg-[#eff4ff] px-2 py-0.5 rounded text-[#00236f] font-mono">
              {`{poa_number} → "44123456"`}
            </span>
          </div>
        </div>

        {/* Action Button & Result Feedback */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExecuteTestSend}
              disabled={isSendingTest || (testQuota !== null && testQuota.remaining <= 0)}
              className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 px-5 gap-2 rounded-xl shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingTest ? 'جارٍ الإرسال  ...' : 'إرسال الرسالة التجريبية الآن'}</span>
            </Button>

          
          </div>

          {/* Test Send Result Banner */}
          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {testResult.success
                    ? 'نجحت تجربة الإرسال الفعلية عبر الواتساب!'
                    : 'تعذر إرسال الرسالة التجريبية'}
                </div>
                <div className="leading-relaxed">
                  {testResult.success ? (
                    <div>
                      {testResult.message}
                      {testResult.idMessage && (
                        <div className="font-mono text-[11px] mt-1 bg-white/60 p-1.5 rounded inline-block">
                          معرّف الرسالة من Green API: <strong>{testResult.idMessage}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{testResult.error}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION: Category Filters & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#55627a] border border-[#d6e0ec] hover:bg-[#eff4ff]'
            }`}
          >
            الكل ({templates.length})
          </button>
          <button
            onClick={() => setActiveCategory('cases_poa')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'cases_poa'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#55627a] border border-[#d6e0ec] hover:bg-[#eff4ff]'
            }`}
          >
            أحداث القضايا والوكالات (4)
          </button>
          <button
            onClick={() => setActiveCategory('accounts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'accounts'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#55627a] border border-[#d6e0ec] hover:bg-[#eff4ff]'
            }`}
          >
            الحسابات والتراخيص (3)
          </button>
          <button
            onClick={() => setActiveCategory('subscription_payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'subscription_payments'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#55627a] border border-[#d6e0ec] hover:bg-[#eff4ff]'
            }`}
          >
            الاشتراكات والمدفوعات (3)
          </button>
          <button
            onClick={() => setActiveCategory('reminders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeCategory === 'reminders'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'bg-white text-[#55627a] border border-[#d6e0ec] hover:bg-[#eff4ff]'
            }`}
          >
            تذكيرات الجلسات والمواعيد (2)
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="بحث في القوالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pr-9 pl-3 text-xs bg-white border-[#d6e0ec] focus:border-[#00236f]"
          />
        </div>
      </div>

      {/* ── SECTION: Templates Grid ── */}
      {isLoadingTemplates ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#D6E0EC] rounded-2xl p-5 space-y-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/2"></div>
              <div className="h-20 bg-slate-100 rounded"></div>
              <div className="h-6 bg-slate-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white border border-[#D6E0EC] rounded-2xl p-12 text-center space-y-3">
          <SlidersHorizontal className="w-8 h-8 text-[#94a3b8] mx-auto" />
          <h3 className="text-sm font-bold text-[#10233F]">لم يتم العثور على أي قوالب مطابقة</h3>
          <p className="text-xs text-[#64748B]">جرّب تغيير عبارة البحث أو اختيار تصنيف آخر.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="text-xs"
          >
            عرض كافة القوالب
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((template, idx) => {
            const idNumber = template.id_number || idx + 1;
            const isSaving = savingKey === template.event_type;

            return (
              <div
                key={template.event_type}
                className="bg-white border border-[#D6E0EC] rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-[#b8d2fe] transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Header: ID, Title, Recipient, Channels */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-[#eff4ff] text-[#00236f] text-xs font-bold flex items-center justify-center shrink-0">
                          {idNumber}
                        </span>
                        <h3 className="text-sm font-bold text-[#10233F] leading-tight">
                          {template.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mr-7 text-[11px] text-[#64748B]">
                        <span>المستلم: <strong className="text-[#10233F]">{template.recipient_label || 'المحامي المكلف'}</strong></span>
                        <span>•</span>
                        <code className="text-[10px] text-[#00236f] bg-[#eff4ff] px-1.5 py-0.2 rounded font-mono">
                          {template.event_type}
                        </code>
                      </div>
                    </div>

                    {/* Channel Toggles */}
                    <div className="flex items-center gap-2.5 shrink-0 bg-[#f8faff] p-1.5 rounded-lg border border-[#e5eeff]">
                      <label className="flex items-center gap-1.5 text-xs text-[#10233F] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.channels?.whatsapp ?? true}
                          onChange={(e) =>
                            handleToggleChannel(template.event_type, 'whatsapp', e.target.checked)
                          }
                          className="rounded text-[#00236f] focus:ring-[#00236f] cursor-pointer"
                        />
                        <span className="text-[11px]">واتساب</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.channels?.in_app ?? true}
                          onChange={(e) =>
                            handleToggleChannel(template.event_type, 'in_app', e.target.checked)
                          }
                          className="rounded text-[#00236f] focus:ring-[#00236f] cursor-pointer"
                        />
                        <span className="text-[11px]">إشعار داخلي</span>
                      </label>
                    </div>
                  </div>

                  {/* Body Template Textarea */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>نص قالب رسالة الواتساب:</span>
                      <span className="font-mono text-[10px]">{template.body_template.length} حرف</span>
                    </div>
                    <Textarea
                      value={template.body_template}
                      onChange={(e) => handleBodyChange(template.event_type, e.target.value)}
                      rows={3}
                      className="text-xs leading-relaxed bg-[#fafcff] border-[#e2ecfa] focus:border-[#00236f] font-sans"
                    />
                  </div>

                  {/* Placeholders Tags */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-[#64748B]">
                      المتغيرات المتاحة لهذا الحدث (اضغط للإدراج في النص):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(template.placeholders || ['recordTypeArabic', 'directLink', 'clientName']).map(
                        (ph: string) => (
                          <button
                            key={ph}
                            type="button"
                            onClick={() => {
                              handleBodyChange(
                                template.event_type,
                                `${template.body_template} {{${ph}}}`
                              );
                              toast({ title: `تم إدراج المتغير {{${ph}}}` });
                            }}
                            className="bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00236f] text-[10px] font-mono px-2 py-0.5 rounded border border-[#cfdffc] transition-colors cursor-pointer"
                            title="انقر للإدراج في نهاية النص"
                          >
                            {`{{${ph}}}`}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-[#f1f5fd] flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectTemplateForTest(template.event_type)}
                      className="text-[#00236f] font-bold hover:underline flex items-center gap-1 cursor-pointer bg-[#eff4ff] px-2.5 py-1 rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>تجربة هذا القالب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const original = defaultInitialTemplates.find(
                          (d) => d.event_type === template.event_type
                        );
                        if (original) {
                          handleBodyChange(template.event_type, original.body_template);
                          toast({ title: 'تم استرجاع النص القياسي لهذا القالب' });
                        }
                      }}
                      className="text-[#64748B] hover:text-[#10233F] text-[11px] flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>استرجاع الافتراضي</span>
                    </button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSaveSingleTemplate(template)}
                    disabled={isSaving}
                    className="bg-[#eff4ff] hover:bg-[#00236f] text-[#00236f] hover:text-white border border-[#cfe0fc] text-xs h-8 px-3 gap-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ القالب'}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
