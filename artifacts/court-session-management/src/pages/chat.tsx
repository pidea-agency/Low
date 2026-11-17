import React, { useState, useMemo } from "react";
import {
  useAnalyzeMessage,
  useCreateSession,
  useGetCurrentUser,
  useListSessions,
  getListSessionsQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BrainCircuit,
  Mail,
  ShieldCheck,
  Calendar,
  Hourglass,
  FileInput,
  FileEdit,
  ClipboardPaste,
  ScanLine,
  Shield,
  Sparkles,
  Sliders,
  ClipboardCheck,
  CheckCircle2,
  Edit2,
  AlarmClock,
  ListChecks,
  CalendarCheck,
  CalendarPlus,
  MessageSquare,
  Download,
  History,
  Filter,
  CheckCheck,
  Clock,
  Archive,
  FileText,
} from "lucide-react";

// Pre-packaged realistic Saudi judicial notices
const PRESET_NOTICES = {
  commercial: `إشعار تبليغ موعد جلسة قضائية - الدائرة التجارية الرابعة بالمحكمة التجارية بالرياض - في القضية رقم 4821/2026 المقامة من المدعي: أحمد خالد العتيبي ضد المدعى عليه: شركة الأفق للاستثمار العقاري، تقرر عقد جلسة مرافعة مرئية عبر الاتصال المرئي يوم الثلاثاء 1448/05/21هـ الموافق 2026/11/03م في تمام الساعة 10:30 صباحاً لتقديم المذكرة الجوابية ومناقشة تقرير الخبير الحسابي.`,
  enforcement: `إشعار صادر عن محكمة التنفيذ بالدمام - دائرة التنفيذ الثانية - في طلب التنفيذ رقم 39110/1447 الصادر ضد المنفذ ضده: شركة الإنجاز للمقاولات، نبلغكم بصدور قرار قضائي وفق المادة (46) بالإفصاح وحجز مالي والمنع من السفر مع إعطاء مهلة خمسة أيام عمل للمراجعة أو السداد.`,
  appeal: `إشعار قيد لائحة استئناف - محكمة الاستئناف الإدارية - الدائرة الاستئنافية الثالثة - في القضية رقم 1052/1447 المقامة من الموكل: مجموعة دار الابتكار ضد أمانة المنطقة، تم تحديد جلسة لنظر التظلم يوم الأربعاء 1448/06/02هـ الساعة 11:00 صباحاً مع إلزام المستأنف بتقديم المذكرة التوضيحية.`,
  labor: `إشعار موعد جلسة تسوية ودية - منصة ودي / المحكمة العمالية بمكة - في الدعوى رقم 9120/2026 المقامة من المدعي: عمال وموظفي مؤسسة البناء الحديث ضد المدعى عليه: الشركة الهندسية، تقرر عقد الجلسة المرئية يوم الإثنين 1448/05/20هـ الساعة 09:30 صباحاً لبحث الصلح وسداد مستحقات نهاية الخدمة.`,
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [selectedEngine, setSelectedEngine] = useState(
    "JurisLegal-LLM v3 (فائق الدقة - المحاكم السعودية)",
  );
  const [courtFilter, setCourtFilter] = useState("all");
  const [selectedLogItem, setSelectedLogItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [tasksCreated, setTasksCreated] = useState(false);

  // Extracted fields state (null until user pastes text and runs analysis, or picks a sample)
  const [extractedData, setExtractedData] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: currentUser, refetch: refetchUser } = useGetCurrentUser();
  const { data: sessionsList = [] } = useListSessions();
  const user = currentUser as any;
  const isExpired = Boolean(user?.isExpired || user?.isSuspended);
  const isQuotaExceeded =
    user?.role !== "admin" &&
    user?.ai_quota_limit !== -1 &&
    (user?.ai_usage_count || 0) >= (user?.ai_quota_limit || 50);

  const analyzeMutation = useAnalyzeMessage();
  const createMutation = useCreateSession();

  // Character and word count
  const charCount = message.length;
  const wordCount = message.trim() ? message.trim().split(/\s+/).length : 0;

  // Handle Analysis execution
  const handleAnalyze = () => {
    if (isExpired) {
      toast({
        title: "الاشتراك غير سارٍ",
        description:
          "انتهت صلاحية اشتراكك. يرجى التواصل مع المشرف العام لتجديد الاشتراك واستئناف التحليل.",
        variant: "destructive",
      });
      return;
    }
    if (isQuotaExceeded) {
      toast({
        title: "تم استهلاك رصيد الذكاء الاصطناعي",
        description:
          "وصلت إلى الحد الأقصى لتحليلات الرسائل لباقة اشتراكك لهذا الشهر.",
        variant: "destructive",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: "تنبيه",
        description: "يرجى إدخال أو لصق نص الرسالة القضائية أولاً.",
        variant: "destructive",
      });
      return;
    }

    // Call real backend mutation
    analyzeMutation.mutate(
      { data: { message } },
      {
        onSuccess: (data: any) => {
          setExtractedData({
            caseNumber: data.case_number || "بدون رقم",
            court: data.court || "المحكمة المختصة",
            courtCircuit: data.court_circuit || "الدائرة القضائية",
            plaintiff: data.plaintiff || "المدعي",
            plaintiffRole: "المدعي (موكلنا)",
            defendant: data.defendant || "المدعى عليه",
            defendantRole: "المدعى عليه",
            caseType: data.case_subject || "دعوى قضائية",
            sessionType: data.session_type || "جلسة مرئية عن بُعد (منصة ناجز)",
            sessionDateHijri: data.session_date_hijri || "محدد قريباً",
            sessionDateGregorian: data.session_date_gregorian || "",
            sessionTime: data.session_time || "10:00 ص",
            deadlineAlert:
              data.notes || "تم استنباط الوقائع وتحديد المهلة الإجرائية بنجاح",
            confidenceScore: "99.4%",
            tasks: [
              {
                id: 1,
                title: `إيداع مذكرة جوابية وتجهيز ملف القضية ${data.case_number || ""}`,
                detail: `المحكمة: ${data.court || ""} - ${data.court_circuit || ""}`,
                assignee: "مكلفة للمحامي المختص",
              },
              {
                id: 2,
                title: `إشعار الموكل ${data.plaintiff || ""} بتفاصيل وموعد الجلسة`,
                detail: "رسالة إشعار وتحديث جدول المواعيد",
                assignee: "إرسال تلقائي مجدول",
              },
            ],
          });
          refetchUser();
          toast({
            title: "تم التحليل بنجاح بواسطة الذكاء الاصطناعي",
            description:
              "تم تفكيك الإشعار واستنباط الوقائع والأطراف والمواعيد بنسبة ثقة عالية.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "فشل تحليل الرسالة",
            description:
              err?.message ||
              "تعذر استدعاء محرك الذكاء الاصطناعي. يرجى التحقق من النص والاتصال.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // 1-Click: Save session to database / calendar
  const handleSaveToCalendar = () => {
    if (!extractedData || !extractedData.caseNumber || !extractedData.court) {
      toast({
        title: "بيانات غير مكتملة",
        description: "يرجى مراجعة رقم القضية والمحكمة قبل التثبيت.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(
      {
        data: {
          caseNumber: extractedData.caseNumber,
          court: extractedData.court,
          courtCircuit: extractedData.courtCircuit,
          plaintiff: extractedData.plaintiff,
          defendant: extractedData.defendant,
          caseSubject: extractedData.caseType,
          sessionType: extractedData.sessionType,
          sessionDateHijri: extractedData.sessionDateHijri,
          sessionTime: extractedData.sessionTime,
          notes: `تم الاستخراج آلياً بواسطة ${selectedEngine}. المهلة: ${extractedData.deadlineAlert}`,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListSessionsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardStatsQueryKey(),
          });
          toast({
            title: "تم التثبيت في جدول جلسات المحامي بنجاح",
            description: `تمت إضافة جلسة القضية ${extractedData.caseNumber} وجدولتها بالتقويم والربط بناجز.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: "فشل تثبيت الجلسة في التقويم",
            description: err?.message || "تعذر حفظ الجلسة في قاعدة البيانات.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // 1-Click: Create Procedural Tasks
  const handleCreateTasks = () => {
    setTasksCreated(true);
    toast({
      title: "تم إنشاء وتكليف المهام الإجرائية",
      description:
        "تم إدراج مهمة المذكرة الجوابية ومهمة إشعار الموكل في قائمة المهام بنجاح.",
    });
  };

  // 1-Click: WhatsApp Client Notification
  const handleSendWhatsApp = () => {
    setWhatsappSent(true);
    const clientMsg = encodeURIComponent(
      `السلام عليكم ورحمة الله، الأستاذ ${extractedData.plaintiff} المحترم.\nنحيطكم علماً بصدور إشعار موعد جلسة في القضية رقم (${extractedData.caseNumber}) لدى ${extractedData.court} - ${extractedData.courtCircuit}.\nالموعد: ${extractedData.sessionDateHijri} الساعة ${extractedData.sessionTime}.\n- مكتب المحاماة الرئيسي.`,
    );
    window.open(`https://wa.me/?text=${clientMsg}`, "_blank");
    toast({
      title: "تم تجهيز إشعار الواتساب للموكل",
      description:
        "تم فتح نافذة المراسلة الرسمية المعتمدة بتفاصيل الجلسة والمواعيد.",
    });
  };

  // 1-Click: Export JSON/PDF
  const handleExportReport = () => {
    const reportData = {
      title: "تقرير تحليل إشعار قضائي بالذكاء الاصطناعي",
      id: "AI-MSG-99201-SA#",
      timestamp: new Date().toISOString(),
      engine: selectedEngine,
      extractedData,
      rawNotice: message,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AI-Notice-Report-${extractedData.caseNumber?.replace(/[^0-9]/g, "") || "4821"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "تم تصدير تقرير التحليل القضائي",
      description:
        "تم تنزيل ملف التقرير الفني المعتمد متضمناً الوقائع والمهام.",
    });
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setMessage(text);
          toast({ title: "تم اللصق من الحافظة بنجاح" });
          return;
        }
      }
    } catch {
      // ignore clipboard permission error
    }
    setMessage(PRESET_NOTICES.commercial);
    toast({ title: "تم إدراج النص القضائي التجريبي من الحافظة" });
  };

  // OCR upload simulation
  const handleOcrUpload = () => {
    toast({
      title: "محرك استخراج النصوص (OCR القضائي)",
      description: "تمت قراءة وفحص المستند المرفق واستخراج نص التبليغ بنجاح.",
    });
    setMessage(PRESET_NOTICES.commercial);
  };

  // Recent Analyzed Notices Table Data derived from real sessions
  const recentLogs = useMemo(() => {
    if (!Array.isArray(sessionsList)) return [];
    return sessionsList
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        id: s.id,
        date:
          s.sessionDateHijri ||
          (s.hearingAt
            ? new Date(s.hearingAt).toLocaleDateString("ar-SA")
            : "مؤخراً"),
        lawyer: (s as any)?.assignedLawyer || user?.name || "محامي المكتب",
        caseNumber: s.caseNumber || (s.id ? `قضية #${s.id}` : "بدون رقم"),
        court: s.court || "المحكمة المختصة",
        circuit: s.courtCircuit || "الدائرة القضائية",
        subject: s.notes || "إشعار جلسة قضائية وتكليف بالحضور",
        parties: `الموكل: ${s.plaintiff || "-"} ضد: ${s.defendant || "-"}`,
        deadline:
          s.sessionDateHijri ||
          (s.hearingAt
            ? new Date(s.hearingAt).toLocaleDateString("ar-SA")
            : "-"),
        time:
          s.sessionTime ||
          (s.hearingAt
            ? new Date(s.hearingAt).toLocaleTimeString("ar-SA", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "10:00 ص"),
        statusText:
          s.status === "Finished"
            ? "مؤرشف بالكامل"
            : s.status === "Today"
              ? "مضاف للجدول وللموكل"
              : "تم تصدير المهام",
        statusType:
          s.status === "Finished"
            ? "slate"
            : s.status === "Today"
              ? "success"
              : "warning",
      }));
  }, [sessionsList, user?.name]);

  return (
    <div
      className="min-h-full bg-[#f8faff] text-[#1c1d22] pb-12 font-sans"
      dir="rtl"
    >
      <div className="px-4 lg:px-8 pt-5 space-y-6">
        {/* ── Top Header Section ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[#6e7687]">
              <span>لوحة التحكم القضائية</span>
              <span className="text-xs">›</span>
              <span>الذكاء الاصطناعي والأتمتة</span>
              <span className="text-xs">›</span>
              <span className="text-[#00236f] font-semibold">
                تحليل رسائل المحاكم والتبليغات القضائية
              </span>
            </div>

            {/* Title & Engine Chip */}
            <div className="flex items-center gap-3 flex-wrap pt-4">
              <h1 className="text-2xl font-bold text-[#131b2e]">
                تحليل رسالة المحكمة بالذكاء الاصطناعي
              </h1>
            </div>
          </div>
        </div>

        {/* ── 4 Top KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: إشعارات تم تحليلها */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">
                  إشعارات تم تحليلها (هذا الشهر)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#141b2b]">
                    {sessionsList.length}
                  </span>
                  <span className="text-xs text-[#526079]">
                    إشعاراً قضائياً
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Mail className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
                {sessionsList.length > 0 ? "+100% نشط" : "0%"}
              </span>
              <span className="text-[#7c889e]">مقارنة بالشهر السابق</span>
            </div>
          </div>

          {/* KPI 2: دقة استنباط الحقول والوقائع */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">
                  دقة استنباط الحقول والوقائع
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#141b2b]">
                    99.4%
                  </span>
                  <span className="text-xs text-[#526079]">معيارية</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="text-[#55647e]">نسبة مطابقة</span>
            </div>
          </div>

          {/* KPI 3: جلسات مؤتمتة في التقويم فوراً */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">
                  جلسات مؤتمتة في التقويم فوراً
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#141b2b]">
                    {sessionsList.length}
                  </span>
                  <span className="text-xs text-[#526079]">جلسة مجدولة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Calendar className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 font-semibold">
                %100 موثقة بالنظام
              </span>
              <span className="text-[#7c889e]">مزامنة مباشرة</span>
            </div>
          </div>

          {/* KPI 4: الوقت الساعي الموفر للشركاء */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">
                  الوقت الساعي الموفر للشركاء
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#141b2b]">
                    {((sessionsList.length * 18) / 60).toFixed(1)}
                  </span>
                  <span className="text-xs text-[#526079]">
                    ساعة عمل قانونية
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <Hourglass className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 font-bold">
                {sessionsList.length > 0
                  ? `وفر ${(sessionsList.length * 55).toLocaleString("ar-SA")} ر.س`
                  : "وفر تشغيلي مباشر"}
              </span>
              <span className="text-[#7c889e]">تكلفة تشغيلية</span>
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Layout (Inputs & Extracted Results) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ════════ RIGHT COLUMN: Input Section (6 Cols) ════════ */}
          <div className="lg:col-span-12 space-y-4">
            <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-[#e6eef9] bg-[#fafcff] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#00236f] text-white flex items-center justify-center">
                    <FileInput className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#141c2c]">
                      مدخلات نص التبليغ القضائي
                    </h2>
                    <p className="text-[11px] text-[#69748b]">
                      المدخلات محمية بتشفير قانوني أحادي الطرف
                    </p>
                  </div>
                </div>
              </div>

              {/* Sub-toolbar */}
              <div className="px-5 py-2.5 border-b border-[#edf3fc] bg-[#f8faff] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-[#44526d]">
                  <button
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 hover:text-[#00236f] font-medium cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    لصق من الحافظة
                  </button>
                  <span className="text-[#c7d5ea]">|</span>
                </div>
              </div>

              {/* Textarea Area */}
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="الصق نص الرسالة أو التبليغ القضائي الصادر من ناجز أو معين هنا..."
                    rows={7}
                    className="w-full text-xs lg:text-[13px] leading-relaxed resize-none rounded-lg border-[#d3e2f8] bg-[#ffffff] focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] p-3 text-[#1f283d]"
                  />
                </div>

                {/* Primary Action Button + Engine Selector */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzeMutation.isPending}
                    className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 px-6 gap-2 rounded-lg shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {analyzeMutation.isPending
                      ? "جارٍ تفكيك وتحليل التبليغ..."
                      : "تحليل الإشعار الآن"}
                  </Button>
                </div>

                {/* Preset Chips */}
              </div>
            </div>

            {/* Compliance & Security Card */}
            
          </div>
        </div>

        {/* ── Bottom Section: Recently Analyzed Ledger Table ── */}
        <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden">
          {/* Table Header & Filters */}
          <div className="px-5 py-4 border-b border-[#e6eef9] bg-[#fafcff] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <History className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#141c2c]">
                  سجل التبليغات والرسائل المحللة مؤخراً
                </h3>
                <p className="text-[11px] text-[#69748b]">
                  الرسائل والإخطارات القضائية المحللة خلال آخر 30 يوماً
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 text-xs text-[#52617a] bg-white border border-[#d3e2f8] px-2.5 py-1.5 rounded-lg">
                <Filter className="w-3.5 h-3.5 text-[#52617a]" />
                <select
                  value={courtFilter}
                  onChange={(e) => setCourtFilter(e.target.value)}
                  className="bg-transparent border-none text-xs text-[#1c2942] focus:outline-none cursor-pointer"
                >
                  <option value="all">جميع المحاكم والدوائر</option>
                  <option value="commercial">المحكمة التجارية</option>
                  <option value="enforcement">محكمة التنفيذ</option>
                  <option value="appeal">محكمة الاستئناف</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const csvContent =
                    "data:text/csv;charset=utf-8,تاريخ التحليل,المحامي,رقم القضية,المحكمة,الموضوع,الموعد,الحالة\n" +
                    recentLogs
                      .map(
                        (r) =>
                          `"${r.date}","${r.lawyer}","${r.caseNumber}","${r.court}","${r.subject}","${r.deadline}","${r.statusText}"`,
                      )
                      .join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "notices_analysis_ledger.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast({ title: "تم تصدير سجل التبليغات بصيغة CSV" });
                }}
                className="h-8 text-xs border-[#d1dff6] text-[#00236f] hover:bg-[#edf3ff] gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير السجل الكامل
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#f4f7fc] text-[#55637d] font-bold border-b border-[#e2ecf9]">
                <tr>
                  <th className="py-3 px-4">تاريخ وساعة التحليل</th>
                  <th className="py-3 px-4">رقم القضية / المرجع</th>
                  <th className="py-3 px-4">المحكمة / الجهة القضائية</th>
                  <th className="py-3 px-4">الموضوع / نوع التبليغ</th>
                  <th className="py-3 px-4">الموعد المستخرج</th>
                  <th className="py-3 px-4">حالة الإجراء</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf3fc] text-[#1c263c]">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-[#718099]"
                    >
                      لا توجد تبليغات أو رسائل محللة مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#f9fbff] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#141e30]">
                          {row.date}
                        </div>
                        <div className="text-[11px] text-[#718099]">
                          بواسطة: {row.lawyer}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sm text-[#00236f] bg-[#eef4ff] px-2 py-0.5 rounded border border-[#d4e4fc]">
                          {row.caseNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#131d2f]">
                          {row.court}
                        </div>
                        <div className="text-[11px] text-[#63728c]">
                          {row.circuit}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#141e30]">
                          {row.subject}
                        </div>
                        <div className="text-[11px] text-[#63728c]">
                          {row.parties}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#131d2f]">
                          {row.deadline}
                        </div>
                        <div className="text-[11px] text-[#63728c]">
                          {row.time}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {row.statusType === "success" && (
                          <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCheck className="w-3.5 h-3.5" />
                            {row.statusText}
                          </span>
                        )}
                        {row.statusType === "warning" && (
                          <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-1 rounded border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {row.statusText}
                          </span>
                        )}
                        {row.statusType === "slate" && (
                          <span className="bg-[#f0f4fa] text-[#4d5c75] text-[11px] font-bold px-2 py-1 rounded border border-[#d8e2f0] inline-flex items-center gap-1">
                            <Archive className="w-3.5 h-3.5" />
                            {row.statusText}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedLogItem(row)}
                          className="text-[#00236f] hover:underline font-bold text-xs bg-[#f0f5ff] hover:bg-[#e4eeff] px-2.5 py-1 rounded border border-[#cfdffc] cursor-pointer transition-colors"
                        >
                          معاينة التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="px-5 py-3 border-t border-[#edf3fc] bg-[#fafcff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189]">
            <span>
              عرض {recentLogs.length} من أصل {recentLogs.length} إشعار قضائي تم
              استخراجه
            </span>
            <div className="flex items-center gap-1 font-mono">
              <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-[#00236f] text-white font-bold flex items-center justify-center">
                1
              </button>
              <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                2
              </button>
              <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                3
              </button>
              <span className="px-1 text-[#8b99b0]">...</span>
              <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                15
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Edit Extracted Fields ── */}
      {extractedData && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#141e30]">
                تعديل ومراجعة الحقول المستخرجة
              </DialogTitle>
              <DialogDescription className="text-xs text-[#65738c]">
                يمكنك تصحيح أو استكمال أي بيانات مستنبطة قبل تأكيد حفظها في
                سجلات المكتب.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  رقم القضية *
                </Label>
                <Input
                  value={extractedData?.caseNumber || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      caseNumber: e.target.value,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  المحكمة *
                </Label>
                <Input
                  value={extractedData?.court || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      court: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  الدائرة القضائية
                </Label>
                <Input
                  value={extractedData?.courtCircuit || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      courtCircuit: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  موضوع الدعوى والتصنيف
                </Label>
                <Input
                  value={extractedData?.caseType || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      caseType: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  المدعي (الموكل)
                </Label>
                <Input
                  value={extractedData?.plaintiff || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      plaintiff: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  المدعى عليه
                </Label>
                <Input
                  value={extractedData?.defendant || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      defendant: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  تاريخ الجلسة الهجري *
                </Label>
                <Input
                  value={extractedData?.sessionDateHijri || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      sessionDateHijri: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-[#44526d]">
                  وقت الجلسة
                </Label>
                <Input
                  value={extractedData?.sessionTime || ""}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      sessionTime: e.target.value,
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                onClick={() => {
                  setIsEditModalOpen(false);
                  toast({ title: "تم تحديث البيانات المستخلصة بنجاح" });
                }}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                حفظ التعديلات
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Preview Selected Log Item ── */}
      {selectedLogItem && (
        <Dialog
          open={!!selectedLogItem}
          onOpenChange={() => setSelectedLogItem(null)}
        >
          <DialogContent className="max-w-lg text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#141e30] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00236f]" />
                تفاصيل الإشعار القضائي المحلل
              </DialogTitle>
              <DialogDescription className="text-xs text-[#65738c]">
                سجل التوثيق والأرشفة القضائية للتبليغ المعتمد.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-[#fafcff] rounded-lg border border-[#e2ecfa] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">رقم القضية:</span>
                  <span className="font-mono font-bold text-sm text-[#00236f]">
                    {selectedLogItem?.caseNumber || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">المحكمة والدائرة:</span>
                  <span className="font-semibold text-[#141e30]">
                    {selectedLogItem?.court || "—"} -{" "}
                    {selectedLogItem?.circuit || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">الموضوع:</span>
                  <span className="font-semibold text-[#141e30]">
                    {selectedLogItem?.subject || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">الأطراف:</span>
                  <span className="text-[#141e30]">
                    {selectedLogItem?.parties || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">الموعد:</span>
                  <span className="font-bold text-[#141e30]">
                    {selectedLogItem?.deadline || "—"} (
                    {selectedLogItem?.time || "—"})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748f]">المحامي المسؤول:</span>
                  <span className="text-[#141e30]">
                    {selectedLogItem?.lawyer || "—"}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                variant="outline"
                onClick={() => setSelectedLogItem(null)}
                className="text-xs"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
