import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Check,
  RotateCcw,
  Send,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
      'مرحباً أستاذ {{memberName}}، تم تكليفك بـ {{recordTypeArabic}} في {{courtName}}. لمتابعة التفاصيل: {{directLink}}',
    placeholders: [
      'recordTypeArabic',
      'courtName',
      'memberName',
      'directLink',
      'recordDescription',
    ],
    category: 'cases_poa',
  },
  {
    event_type: 'poa_assigned',
    id_number: 2,
    name: 'تكليف بوكالة قانونية جديدة',
    recipient_label: 'المحامي المكلف',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم تكليفك بوكالة رقم {{poaNumber}} الخاصة بالموكل {{clientName}} لمباشرة الإجراءات.',
    placeholders: ['issueDate', 'clientName', 'poaNumber', 'directLink'],
    category: 'cases_poa',
  },
  {
    event_type: 'poa_expiring',
    id_number: 3,
    name: 'تنبيه قرب انتهاء وكالة (قبل 30 يوماً)',
    recipient_label: 'المحامي المكلف ومدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تنبيه: تنتهي الوكالة رقم {{poaNumber}} للموكل {{clientName}} خلال {{daysRemaining}} أيام. يُرجى متابعة التجديد.',
    placeholders: ['daysRemaining', 'clientName', 'poaNumber', 'expiryDate'],
    category: 'cases_poa',
  },
  {
    event_type: 'new_document_uploaded',
    id_number: 4,
    name: 'إضافة مستند أو مرفق جديد',
    recipient_label: 'المحامي المكلف',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'أضاف {{uploaderName}} مستنداً ({{documentName}}) على {{recordTypeArabic}} رقم {{recordNumber}}.',
    placeholders: [
      'recordTypeArabic',
      'documentName',
      'uploaderName',
      'recordNumber',
    ],
    category: 'cases_poa',
  },
  {
    event_type: 'member_activation_invite',
    id_number: 5,
    name: 'دعوة تفعيل حساب عضو جديد',
    recipient_label: 'العضو الجديد',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'أهلاً أستاذ {{memberName}}، تمت دعوتك للانضمام إلى {{officeName}}. فعّل حسابك من هنا: {{activationLink}}',
    placeholders: ['activationLink', 'officeName', 'memberName'],
    category: 'accounts',
  },
  {
    event_type: 'member_account_suspended',
    id_number: 6,
    name: 'إيقاف حساب عضو',
    recipient_label: 'العضو المعني',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم إيقاف حسابك في {{officeName}}. تواصل مع إدارة المكتب لمزيد من التفاصيل.',
    placeholders: ['adminContact', 'reason', 'officeName'],
    category: 'accounts',
  },
  {
    event_type: 'subscription_expiring_soon',
    id_number: 7,
    name: 'قرب انتهاء اشتراك المكتب',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'اشتراك المكتب في {{planName}} ينتهي خلال {{daysRemaining}} أيام ({{endDate}}). يُرجى التجديد للاستمرار دون انقطاع.',
    placeholders: ['endDate', 'daysRemaining', 'planName', 'renewLink'],
    category: 'subscription_payments',
  },
  {
    event_type: 'payment_recorded',
    id_number: 8,
    name: 'تسجيل دفعة مالية من موكل',
    recipient_label: 'المحامي المكلف ومدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تم تسجيل دفعة بقيمة {{amount}} {{currency}} (مرجع {{reference}}) للقضية {{caseNumber}}.',
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
      'تذكير: جلسة القضية رقم {{caseNumber}} بتاريخ {{sessionDate}} الساعة {{sessionTime}} في {{court}} — الدائرة {{circuit}}.',
    placeholders: [
      'sessionTime',
      'sessionDate',
      'caseNumber',
      'circuit',
      'court',
    ],
    category: 'reminders',
  },
  {
    event_type: 'reminder_failed',
    id_number: 10,
    name: 'تعذّر إرسال تذكير جلسة تلقائي',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: true },
    body_template:
      'تعذّر إرسال تذكير جلسة القضية رقم {{caseNumber}} بسبب: {{error}}.',
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
      'رخصة المحاماة للعضو {{memberName}} (رقم {{licenseNumber}}) تنتهي خلال {{daysRemaining}} يوماً في {{expiryDate}}.',
    placeholders: [
      'memberName',
      'licenseNumber',
      'daysRemaining',
      'expiryDate',
    ],
    category: 'accounts',
  },
  {
    event_type: 'subscription_suspended',
    id_number: 12,
    name: 'تعليق اشتراك المكتب',
    recipient_label: 'مدير المكتب',
    channels: { in_app: true, whatsapp: false },
    body_template:
      'تم تعليق اشتراك {{officeName}} في {{platformName}}. يُرجى مراجعة الإدارة لتسوية الحساب.',
    placeholders: ['platformName', 'officeName', 'reason'],
    category: 'subscription_payments',
  },
];

const samplePlaceholderMap: Record<string, string> = {
  recordTypeArabic: 'جلسة قضائية',
  record_type_arabic: 'جلسة قضائية',
  recordDescription: 'دعوى رقم 1042/1447',
  directLink: 'https://app.example.com/cases/1042',
  courtName: 'المحكمة العامة',
  court: 'المحكمة العامة',
  circuit: 'الثالثة',
  memberName: 'أ. سامي العلي',
  poaNumber: '44123456',
  clientName: 'خالد المنصور',
  daysRemaining: '5',
  expiryDate: '1448/04/10',
  issueDate: '1447/04/10',
  documentName: 'لائحة_دعوى.pdf',
  uploaderName: 'أ. ريم الحسن',
  recordNumber: '1042/1447',
  activationLink: 'https://app.example.com/activate',
  officeName: 'مكتب العدالة للمحاماة',
  adminContact: '0500000000',
  reason: 'تحديث بيانات الحساب',
  planName: 'باقة المكاتب',
  endDate: '1448/06/30',
  renewLink: 'https://app.example.com/subscription',
  amount: '2,500',
  currency: 'ر.س',
  reference: 'PAY-804',
  caseNumber: '1042/1447',
  sessionDate: '1448/03/25',
  sessionTime: '10:00 ص',
  recipientPhone: '966500000000',
  error: 'انقطاع اتصال البوابة',
  licenseNumber: '381234',
  platformName: 'ديوان',
};

function substitutePlaceholders(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return samplePlaceholderMap[key] ?? `[${key}]`;
  });
}

const CATEGORY_TABS: Array<{
  id: string;
  label: string;
  category?: NotificationTemplate['category'];
}> = [
  { id: 'all', label: 'الكل' },
  { id: 'cases_poa', label: 'القضايا والوكالات', category: 'cases_poa' },
  { id: 'reminders', label: 'تذكيرات الجلسات', category: 'reminders' },
  { id: 'accounts', label: 'الحسابات والرخص', category: 'accounts' },
  {
    id: 'subscription_payments',
    label: 'الاشتراك والمدفوعات',
    category: 'subscription_payments',
  },
];

export default function NotificationSettingsPage() {
  const { toast } = useToast();

  const [templates, setTemplates] = useState<NotificationTemplate[]>(
    defaultInitialTemplates
  );
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // طريقة عرض هادئة: قسم واحد مفتوح للتعديل في كل مرة، واختبار قابل للطي
  const [expandedEventType, setExpandedEventType] = useState<string | null>(
    'case_assigned'
  );
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testEventType, setTestEventType] = useState<string>('case_assigned');
  const [isCustomText, setIsCustomText] = useState(false);
  const [customTestText, setCustomTestText] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    idMessage?: string;
    error?: string;
  } | null>(null);
  const [testQuota, setTestQuota] = useState<{
    remaining: number;
    max: number;
  } | null>(null);

  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch('/api/settings/notification-templates', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const merged = defaultInitialTemplates.map((def) => {
            const found = data.find(
              (d: any) => d.event_type === def.event_type
            );
            return found ? { ...def, ...found } : def;
          });
          setTemplates(merged);
        }
      }
    } catch {
      // Keep defaults on network failure
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchQuota = async () => {
    try {
      const res = await fetch(
        '/api/settings/notification-templates/test-send/quota',
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setTestQuota({ remaining: data.remaining, max: data.max });
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchQuota();
  }, []);

  const handleToggleChannel = (
    eventType: string,
    channel: 'in_app' | 'whatsapp',
    enabled: boolean
  ) => {
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
      prev.map((t) =>
        t.event_type === eventType ? { ...t, body_template: text } : t
      )
    );
  };

  const insertPlaceholderAtCursor = (eventType: string, placeholder: string) => {
    const token = `{{${placeholder}}}`;
    const el = textareaRefs.current[eventType];
    const currentText =
      templates.find((t) => t.event_type === eventType)?.body_template ?? '';

    if (!el) {
      handleBodyChange(eventType, `${currentText} ${token}`.trim());
      return;
    }

    const start = el.selectionStart ?? currentText.length;
    const end = el.selectionEnd ?? currentText.length;
    const nextText =
      currentText.slice(0, start) + token + currentText.slice(end);

    handleBodyChange(eventType, nextText);

    requestAnimationFrame(() => {
      el.focus();
      const nextPos = start + token.length;
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const persistTemplate = async (template: NotificationTemplate) => {
    const res = await fetch(
      `/api/settings/notification-templates/${template.event_type}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channels: template.channels,
          body_template: template.body_template,
          title_template: template.title_template || template.name,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'تعذر حفظ القالب');
    }
  };

  const handleSaveSingleTemplate = async (template: NotificationTemplate) => {
    setSavingKey(template.event_type);
    try {
      await persistTemplate(template);
      toast({
        title: 'تم الحفظ',
        description: `تم تحديث قالب "${template.name}".`,
      });
    } catch (err: any) {
      toast({
        title: 'لم يتم الحفظ',
        description: err?.message || 'حدث خطأ أثناء حفظ القالب.',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAllTemplates = async () => {
    setIsSavingAll(true);
    let failedCount = 0;

    for (const t of templates) {
      try {
        await persistTemplate(t);
      } catch {
        failedCount += 1;
      }
    }

    setIsSavingAll(false);

    if (failedCount === 0) {
      toast({
        title: 'تم حفظ جميع القوالب',
        description: 'أصبحت التعديلات معتمدة لجميع التنبيهات.',
      });
    } else {
      toast({
        title: 'تم الحفظ جزئياً',
        description: `تم حفظ ${templates.length - failedCount} قوالب، وتعذّر حفظ ${failedCount}.`,
        variant: 'destructive',
      });
    }
  };

  const handleResetAllTemplates = () => {
    setTemplates(defaultInitialTemplates);
    toast({
      title: 'تمت الاستعادة',
      description: 'أُعيدت جميع القوالب إلى نصها الافتراضي (اضغط حفظ لاعتمادها).',
    });
  };

  const openTestForEvent = (eventType: string) => {
    setTestEventType(eventType);
    setIsTestDrawerOpen(true);
    const target = templates.find((t) => t.event_type === eventType);
    if (target && isCustomText) {
      setCustomTestText(target.body_template);
    }
  };

  const handleExecuteTestSend = async () => {
    const cleanPhone = testPhone.trim();
    if (!cleanPhone) {
      toast({
        title: 'أدخل رقم الهاتف أولاً',
        description: 'اكتب رقم المستلم مع رمز الدولة لإرسال الرسالة التجريبية.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const payload: Record<string, any> = {
        phone: cleanPhone,
        eventType: testEventType,
      };

      if (isCustomText && customTestText.trim()) {
        payload.customMessage = customTestText.trim();
      }

      const res = await fetch(
        '/api/settings/notification-templates/test-send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'تعذّر إرسال الرسالة التجريبية.';
        setTestResult({ success: false, error: errorMsg });
        toast({
          title: 'تعذّر الإرسال',
          description: errorMsg,
          variant: 'destructive',
        });
      } else {
        setTestResult({
          success: true,
          message: data.message || 'تم إرسال الرسالة التجريبية بنجاح.',
          idMessage: data.idMessage,
        });
        if (typeof data.remaining === 'number') {
          setTestQuota((prev) => ({
            remaining: data.remaining,
            max: prev?.max ?? 10,
          }));
        }
        toast({
          title: 'تم إرسال التجربة',
          description: 'تحقق من وصول الرسالة إلى هاتفك.',
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'تعذّر الاتصال بالخادم.';
      setTestResult({ success: false, error: errorMsg });
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

  const currentSelectedTestTemplate = useMemo(
    () =>
      templates.find((t) => t.event_type === testEventType) ||
      defaultInitialTemplates[0],
    [templates, testEventType]
  );

  const previewSourceText =
    isCustomText && customTestText.trim()
      ? customTestText
      : currentSelectedTestTemplate.body_template;

  const renderedPreviewText = useMemo(
    () => substitutePlaceholders(previewSourceText),
    [previewSourceText]
  );

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesCategory =
        activeCategory === 'all' || t.category === activeCategory;
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.body_template.toLowerCase().includes(q) ||
        (t.recipient_label || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [templates, activeCategory, searchQuery]);

  return (
    <div
      dir="rtl"
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
    >
      {/* 1. ترويسة بسيطة وإجراءات واضحة */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00236f] text-white flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#0b1c30]">
              قوالب الرسائل والتنبيهات
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              اضغط على أي تنبيه لتعديل نصه أو قنواته، أو افتح التجربة السريعة لإرسال رسالة اختبار.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsTestDrawerOpen((prev) => !prev)}
            className="border-[#00236f]/30 text-[#00236f] hover:bg-[#eff4ff] text-xs font-bold h-9 px-3.5 rounded-xl gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTestDrawerOpen ? 'إخفاء التجربة' : 'إرسال تجربة'}</span>
          </Button>

          <Button
            type="button"
            onClick={handleSaveAllTemplates}
            disabled={isSavingAll}
            className="bg-[#00236f] hover:bg-[#001b56] text-white text-xs font-bold h-9 px-4 rounded-xl gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSavingAll ? 'جارٍ الحفظ...' : 'حفظ الكل'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleResetAllTemplates}
            className="text-slate-700 border-slate-200 hover:bg-slate-50 text-xs font-semibold h-9 px-3 rounded-xl gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>استعادة الافتراضي</span>
          </Button>

          <Link href="/settings">
            <Button
              variant="outline"
              className="text-slate-700 border-slate-200 hover:bg-slate-50 text-xs font-semibold h-9 px-3 rounded-xl gap-1.5 cursor-pointer"
            >
              <span>البوابة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. لوحة التجربة السريعة (تُفتح عند الحاجة فقط) */}
      {isTestDrawerOpen && (
        <section
          aria-label="تجربة إرسال رسالة"
          className="bg-[#f6f9ff] border border-blue-200/80 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#0b1c30]">
                تجربة إرسال رسالة على واتساب
              </h2>
              <p className="text-xs text-slate-500">
                أدخل رقماً للاختبار وتأكد من شكل الرسالة قبل اعتمادها.
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#00236f] bg-white border border-blue-200/70 px-3 py-1 rounded-full self-start sm:self-auto">
              المتبقي: {testQuota ? `${testQuota.remaining} من ${testQuota.max}` : '10'} / ساعة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#00236f]" />
                <span>رقم الواتساب</span>
              </label>
              <Input
                type="text"
                dir="ltr"
                placeholder="972501234567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="h-10 text-xs bg-white border-slate-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  التنبيه المختار
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isCustomText;
                    setIsCustomText(next);
                    if (next) {
                      setCustomTestText(currentSelectedTestTemplate.body_template);
                    }
                  }}
                  className="text-[11px] font-semibold text-[#00236f] hover:underline cursor-pointer"
                >
                  {isCustomText ? 'استخدام نص القالب' : 'تعديل النص للتجربة'}
                </button>
              </div>
              <select
                value={testEventType}
                onChange={(e) => {
                  setTestEventType(e.target.value);
                  const found = templates.find(
                    (t) => t.event_type === e.target.value
                  );
                  if (found && isCustomText) {
                    setCustomTestText(found.body_template);
                  }
                }}
                className="w-full h-10 px-3 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-[#00236f]"
              >
                {templates.map((t) => (
                  <option key={t.event_type} value={t.event_type}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isCustomText && (
            <Textarea
              value={customTestText}
              onChange={(e) => setCustomTestText(e.target.value)}
              rows={2}
              className="text-xs bg-white border-slate-200"
            />
          )}

          <div className="rounded-xl bg-white border border-blue-100 p-3.5 space-y-1">
            <div className="text-[11px] font-semibold text-[#00236f]">
              معاينة الرسالة
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {renderedPreviewText}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleExecuteTestSend}
              disabled={
                isSendingTest || (testQuota !== null && testQuota.remaining <= 0)
              }
              className="bg-[#00236f] hover:bg-[#001b56] text-white text-xs font-bold h-9 px-4 rounded-xl gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTest ? 'جارٍ الإرسال...' : 'إرسال الآن'}</span>
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">
                  {testResult.success ? 'تم الإرسال بنجاح' : 'تعذّر الإرسال'}
                </div>
                <div>
                  {testResult.success ? testResult.message : testResult.error}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. التصفية والبحث في سطر واحد هادئ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#00236f] text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="بحث في التنبيهات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pr-8 pl-3 text-xs bg-white border-slate-200"
          />
        </div>
      </div>

      {/* 4. قائمة منظمة: صف مختصر لكل قالب يفتح للتعديل عند النقر */}
      {isLoadingTemplates ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-16 rounded-2xl bg-white border border-slate-200/80 animate-pulse"
            />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <SlidersHorizontal className="w-7 h-7 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">لا توجد تنبيهات مطابقة</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="text-xs cursor-pointer"
          >
            عرض الكل
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {filteredTemplates.map((template) => {
            const isExpanded = expandedEventType === template.event_type;
            const isSaving = savingKey === template.event_type;
            const defaultTpl = defaultInitialTemplates.find(
              (d) => d.event_type === template.event_type
            );
            const isModified =
              defaultTpl !== undefined &&
              template.body_template !== defaultTpl.body_template;

            const waOn = template.channels?.whatsapp ?? true;
            const appOn = template.channels?.in_app ?? true;

            return (
              <div key={template.event_type} className="transition-colors">
                {/* صف العنوان المختصر */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedEventType(
                      isExpanded ? null : template.event_type
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedEventType(
                        isExpanded ? null : template.event_type
                      );
                    }
                  }}
                  className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none ${
                    isExpanded ? 'bg-[#f8faff]' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-[#0b1c30] truncate">
                        {template.name}
                      </span>
                      {isModified && (
                        <span className="text-[10px] font-semibold text-[#00236f] bg-[#eff4ff] px-2 py-0.5 rounded-full shrink-0">
                          معدّل
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      المستلم: {template.recipient_label || 'المعني'} —{' '}
                      {substitutePlaceholders(template.body_template)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        waOn
                          ? 'bg-[#eff4ff] text-[#00236f]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      واتساب {waOn ? 'مفعّل' : 'متوقف'}
                    </span>
                    <span
                      className={`hidden sm:inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        appOn
                          ? 'bg-[#eff4ff] text-[#00236f]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      داخلي {appOn ? 'مفعّل' : 'متوقف'}
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* منطقة التعديل الموسّعة للقالب المحدد فقط */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-2 bg-[#f8faff] space-y-4 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 text-slate-800 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={waOn}
                            onChange={(e) =>
                              handleToggleChannel(
                                template.event_type,
                                'whatsapp',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300 text-[#00236f] focus:ring-[#00236f] cursor-pointer"
                          />
                          <span>إرسال عبر واتساب</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-slate-800 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={appOn}
                            onChange={(e) =>
                              handleToggleChannel(
                                template.event_type,
                                'in_app',
                                e.target.checked
                              )
                            }
                            className="rounded border-slate-300 text-[#00236f] focus:ring-[#00236f] cursor-pointer"
                          />
                          <span>إشعار داخل النظام</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => openTestForEvent(template.event_type)}
                          className="font-semibold text-[#00236f] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>تجربة هذا القالب</span>
                        </button>

                        {isModified && defaultTpl && (
                          <button
                            type="button"
                            onClick={() =>
                              handleBodyChange(
                                template.event_type,
                                defaultTpl.body_template
                              )
                            }
                            className="text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            إرجاع النص الأصلي
                          </button>
                        )}
                      </div>
                    </div>

                    <Textarea
                      ref={(el) => {
                        textareaRefs.current[template.event_type] = el;
                      }}
                      value={template.body_template}
                      onChange={(e) =>
                        handleBodyChange(template.event_type, e.target.value)
                      }
                      rows={3}
                      className="text-xs sm:text-sm leading-relaxed bg-white border-slate-200 focus:border-[#00236f]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {template.placeholders?.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-500 ml-1">
                            إدراج متغير:
                          </span>
                          {template.placeholders.map((ph) => (
                            <button
                              key={ph}
                              type="button"
                              onClick={() =>
                                insertPlaceholderAtCursor(
                                  template.event_type,
                                  ph
                                )
                              }
                              className="text-[11px] font-mono bg-white hover:bg-[#eff4ff] text-slate-700 hover:text-[#00236f] border border-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                              {`{{${ph}}}`}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span />
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveSingleTemplate(template)}
                        disabled={isSaving}
                        className="bg-[#00236f] hover:bg-[#001b56] text-white text-xs font-bold h-8 px-4 rounded-lg gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isSaving ? 'جارٍ الحفظ...' : 'حفظ هذا القالب'}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}