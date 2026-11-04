import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, Link } from 'wouter';
import {
  useGetSession,
  useGetSessionReport,
} from '@workspace/api-client-react';
import type { SessionReportInput } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Download, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const PRINT_STYLE = `
@media print {
  body { background-color: white !important; color: black !important; }
  body > * { display: none !important; }
  #report-print-area {
    display: block !important; position: absolute; top: 0; left: 0;
    width: 100%; margin: 0; padding: 0;
    border: none !important; box-shadow: none !important; background: white !important;
  }
  .print-hidden { display: none !important; }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.spinner-slow { animation: spin-slow 0.8s linear infinite; }

/* Force crisp, fully opaque, sharp text and background inside the report area */
#report-print-area {
  background-color: #ffffff !important;
  color: #4B4B4B !important;
  opacity: 1 !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

@media print {
  @page { size: A4 portrait; margin: 0; }
  #report-print-area { page-break-inside: avoid !important; break-inside: avoid !important; }
}

#report-print-area input,
#report-print-area textarea,
#report-print-area select {
  background-color: transparent !important;
  color: #4B4B4B !important;
  -webkit-text-fill-color: #4B4B4B !important;
  opacity: 1 !important;
  filter: none !important;
  letter-spacing: normal !important;
}

#report-print-area input::placeholder,
#report-print-area textarea::placeholder {
  color: #94a3b8 !important;
  -webkit-text-fill-color: #94a3b8 !important;
  opacity: 1 !important;
}
`;

// Extended interface allowing full editing freedom for all fields in the report
export interface EditableReportForm extends SessionReportInput {
  sessionDay?: string;
  sessionDate?: string;
  court?: string;
  courtCircuit?: string;
  plaintiff?: string;
  defendant?: string;
  caseSubject?: string;
  caseNumber?: string;
}

// Exact hex colors matching legal brand identity:
// Primary: #3F4A2C (Deep Olive), Gold: #C9A449, Body Text: #22261D, Light Bg: #F6F1E3
const C = {
  green: '#3F4A2C',
  greenLight: '#52603B',
  gold: '#C9A449',
  goldDark: '#B59138',
  white: '#ffffff',
  slateLabelBg: '#F6F1E3',
  bodyText: '#22261D',
  border: '#C9A449',
  lightBorder: '#E7E0CB',
  dimText: '#6B6E60',
};

// Table cell styles with SOLID vivid colors for crisp rendering
const th: React.CSSProperties = {
  backgroundColor: '#3F4A2C',
  color: '#ffffff',
  fontWeight: '700',
  textAlign: 'center',
  fontSize: '11.5px',
  padding: '10px 12px',
  border: '1px solid #C9A449',
  whiteSpace: 'nowrap',
  letterSpacing: 'normal',
};

const td: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#22261D',
  textAlign: 'center',
  fontSize: '11.5px',
  fontWeight: '600',
  padding: '10px 12px',
  border: '1px solid #C9A449',
  letterSpacing: 'normal',
};

const emptyForm = (): EditableReportForm => ({
  reportNumber: '',
  lawyerName: '',
  summary: '',
  courtDecision: '',
  nextSessionDate: '',
  nextSessionTime: '',
  ourActionRequired: 'لا يوجد.',
  clientActionRequired: 'لا يوجد.',
  reportDate: new Date().toISOString().split('T')[0],
  sessionDay: '',
  sessionDate: '',
  court: '',
  courtCircuit: '',
  plaintiff: '',
  defendant: '',
  caseSubject: '',
  caseNumber: '',
});

export default function SessionReportPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading: sessionLoading } = useGetSession(id);
  const { data: existingReport, isLoading: reportLoading } = useGetSessionReport(id);

  const [form, setForm] = useState<EditableReportForm>(emptyForm());
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Helper functions for Arabic day & date
  const getGregorianDate = () => {
    if (!session?.hearingAt) return '—';
    return session.hearingAt.split('T')[0];
  };

  const getArabicDay = () => {
    if (!session?.hearingAt) return '—';
    try {
      const date = new Date(session.hearingAt);
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[date.getDay()];
    } catch { return '—'; }
  };

  const getNextSessionDay = () => {
    if (!form.nextSessionDate) return '—';
    try {
      const date = new Date(form.nextSessionDate);
      if (isNaN(date.getTime())) return '—';
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[date.getDay()];
    } catch { return '—'; }
  };

  useEffect(() => {
    const localKey = `session_report_draft_${id}`;
    const savedLocal = localStorage.getItem(localKey);
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        setForm((prev) => ({ ...prev, ...parsed }));
        return;
      } catch (e) {}
    }

    if (existingReport || session) {
      setForm({
        reportNumber: existingReport?.reportNumber || String(id),
        lawyerName: existingReport?.lawyerName || '',
        summary: existingReport?.summary || '',
        courtDecision: existingReport?.courtDecision || '',
        nextSessionDate: existingReport?.nextSessionDate || '',
        nextSessionTime: existingReport?.nextSessionTime || '',
        ourActionRequired: existingReport?.ourActionRequired || 'لا يوجد.',
        clientActionRequired: existingReport?.clientActionRequired || 'لا يوجد.',
        reportDate: existingReport?.reportDate || new Date().toISOString().split('T')[0],
        // Pre-fill editable session info from session object
        sessionDay: getArabicDay(),
        sessionDate: getGregorianDate(),
        court: session?.court || '',
        courtCircuit: session?.courtCircuit || '',
        plaintiff: session?.plaintiff || '',
        defendant: session?.defendant || '',
        caseSubject: session?.caseSubject || '',
        caseNumber: session?.caseNumber || '',
      });
    }
  }, [existingReport, session, id]);

  const handleChange = (field: keyof EditableReportForm, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      const localKey = `session_report_draft_${id}`;
      localStorage.setItem(localKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Render input helper
  const renderField = (
    field: keyof EditableReportForm,
    placeholder: string,
    styleOverride: React.CSSProperties = {},
    className = ''
  ) => {
    const val = form[field] ?? '';
    if (isExportingPdf) {
      return (
        <span style={{ fontWeight: '600', color: C.bodyText, display: 'inline-block', textAlign: 'center', width: '100%', ...styleOverride }}>
          {String(val) || placeholder}
        </span>
      );
    }
    return (
      <input
        type="text"
        value={val}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: '11.5px',
          color: C.bodyText,
          fontWeight: '600',
          textAlign: 'center',
          ...styleOverride,
        }}
        className={className}
      />
    );
  };

  // Render textarea helper
  const renderTextarea = (
    field: keyof EditableReportForm,
    rows: number,
    placeholder: string,
    styleOverride: React.CSSProperties = {}
  ) => {
    const val = form[field] ?? '';
    if (isExportingPdf) {
      return (
        <div style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.8',
          fontSize: '12px',
          color: C.bodyText,
          textAlign: 'right',
          direction: 'rtl',
          minHeight: '40px',
          ...styleOverride,
          border: 'none',
          resize: undefined,
          outline: 'none',
        }}>
          {String(val) || placeholder}
        </div>
      );
    }
    return (
      <textarea
        rows={rows}
        value={val}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        style={styleOverride}
      />
    );
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsDownloadingPdf(true);

    // flushSync forces React to update the DOM synchronously before html2canvas runs
    flushSync(() => setIsExportingPdf(true));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    try {
      const element = printRef.current;
      const filename = `تقرير_جلسة_${form.caseNumber || id}_${form.reportDate || '1448'}.pdf`;

      const opt = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename,
        image: { type: 'jpeg' as const, quality: 1.0 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: element.offsetWidth || 794,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait' as const,
        },
        pagebreak: { mode: 'avoid-all' },
      };

      await html2pdf()
        .set(opt)
        .from(element)
        .save();

      setDownloaded(true);
      toast({
        title: 'تم تنزيل التقرير بنجاح 📄',
        description: 'تم حفظ التقرير بصيغة PDF عالية الجودة.',
      });
      setTimeout(() => setDownloaded(false), 5000);
    } catch (err: any) {
      toast({
        title: 'خطأ أثناء التنزيل',
        description: err?.message || 'تعذّر تنزيل ملف PDF.',
        variant: 'destructive',
      });
    } finally {
      flushSync(() => setIsExportingPdf(false));
      setIsDownloadingPdf(false);
    }
  };



  if (sessionLoading || reportLoading) {
    return (
      <div className="p-8 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-[600px] w-full bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-5">
          <p className="text-destructive font-medium">الجلسة غير موجودة.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="p-6 lg:p-8 space-y-5 max-w-4xl mx-auto">

        {/* ── Actions Toolbar Header ── */}
        <div
          className="print-hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '14px 20px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: `1px solid rgba(184,138,59,0.3)`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
          {/* Back button */}
          <Link href="/reports">
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #E5E5E5',
                backgroundColor: '#F5F5F5',
                color: C.green,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <ArrowRight style={{ width: '15px', height: '15px' }} />
              العودة للتقارير
            </button>
          </Link>

          {/* Page title badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              backgroundColor: C.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText style={{ width: '15px', height: '15px', color: '#fff' }} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: '700', color: C.green }}>
              تقرير الجلسة
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              data-testid="button-download-pdf"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: C.green,
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 10px rgba(15,39,71,0.3)',
              }}
            >
              {isDownloadingPdf ? (
                <>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    animation: 'spin-slow 0.8s linear infinite',
                  }} />
                  جاري التحميل...
                </>
              ) : downloaded ? (
                <>
                  <CheckCircle2 style={{ width: '15px', height: '15px', color: '#86efac' }} />
                  تم التحميل ✓
                </>
              ) : (
                <>
                  <Download style={{ width: '15px', height: '15px' }} />
                  تنزيل PDF
                </>
              )}
            </button>

            {/* Print */}
            <button
              onClick={handleBrowserPrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: `1px solid #C9A449`,
                backgroundColor: '#FBF7EE',
                color: '#9B722C',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <Printer style={{ width: '15px', height: '15px' }} />
              طباعة
            </button>
          </div>
        </div>

        {/* ── Info Notice ── */}
        <div
          className="print-hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: '#FBF7EE',
            border: '1px solid #F5E6C8',
          }}
        >
          <div style={{ fontSize: '13px', color: '#9B722C', lineHeight: '1.5' }}>
            💡 <strong>ملاحظة:</strong> جميع حقول التقرير قابلة للتعديل بحرية كاملة ومباشرة، ويتم حفظ المسودة تلقائياً.
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
             PRINTABLE REPORT AREA — 100% Solid, Opaque, Crisp White Paper
            ═══════════════════════════════════════════════════════════ */}
        <div
          id="report-print-area"
          ref={printRef}
          style={{
            direction: 'rtl',
            backgroundColor: '#ffffff',
            color: '#4B4B4B',
            fontFamily: 'Arial, "Segoe UI", sans-serif',
            border: `1px solid #C9A449`,
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            opacity: 1,
          }}
        >

          {/* ── Header Table (Bulletproof Layout for html2canvas) ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '3px solid #C9A449', backgroundColor: '#ffffff' }}>
            <tbody>
              <tr>
                <td style={{ padding: '12px 24px', verticalAlign: 'top', width: '45%' }}>
                  <img src="/logo.png" alt="Mohammed Alay Logo" style={{ height: '110px', maxHeight: '120px', maxWidth: '280px', objectFit: 'contain', display: 'block', marginTop: '4px' }} />
                </td>
                <td style={{ padding: '0' }} />
                <td style={{ verticalAlign: 'top', textAlign: 'left', width: '260px', padding: '0' }}>
                  <div style={{
                    backgroundColor: '#3F4A2C',
                    color: '#ffffff',
                    padding: '24px 28px',
                    borderBottomLeftRadius: '22px',
                    borderBottomRightRadius: '0px',
                    textAlign: 'center',
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'block',
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '800',
                      color: '#ffffff',
                      lineHeight: '1.4',
                      direction: 'rtl',
                      textAlign: 'center',
                    }}>
                      تقرير الجلسة
                    </div>
                    <div style={{
                      fontSize: '13px',
                      letterSpacing: '2.5px',
                      marginTop: '6px',
                      color: '#C9A449',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      direction: 'ltr',
                      textAlign: 'center',
                    }}>
                      SESSION REPORT
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px', backgroundColor: '#ffffff' }}>

            {/* Report Number Badge */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#3F4A2C',
                backgroundColor: '#F5F5F5',
                padding: '6px 20px',
                borderRadius: '999px',
                border: '1px solid #C9A449',
                display: 'inline-block',
                textAlign: 'center',
              }}>
                {isExportingPdf ? (
                  <span style={{ color: '#3F4A2C', fontWeight: '700', fontSize: '13px' }}>
                    تقرير رقم ( {form.reportNumber || String(id)} )
                  </span>
                ) : (
                  <>
                    <span>تقرير رقم ( </span>
                    <input
                      type="text"
                      value={form.reportNumber ?? String(id)}
                      onChange={(e) => handleChange('reportNumber', e.target.value)}
                      placeholder={String(id)}
                      style={{
                        width: '50px',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '13px',
                        color: '#3F4A2C',
                        fontWeight: '700',
                        textAlign: 'center',
                        padding: 0,
                      }}
                    />
                    <span> )</span>
                  </>
                )}
              </div>
            </div>


            {/* ── Main Info Table (FULLY EDITABLE FIELDS) ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', backgroundColor: '#ffffff' }}>
              <tbody>
                <tr>
                  <td style={th}>اليوم</td>
                  <td style={td}>
                    {renderField('sessionDay', 'اليوم...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                  <td style={th}>التاريخ</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>
                    {renderField('sessionDate', 'YYYY-MM-DD', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', fontFamily: 'monospace', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                </tr>
                <tr>
                  <td style={th}>المحكمة</td>
                  <td style={td}>
                    {renderField('court', 'المحكمة...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                  <td style={th}>الدائرة</td>
                  <td style={td}>
                    {renderField('courtCircuit', 'الدائرة...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                </tr>
                <tr>
                  <td style={th}>المدعي</td>
                  <td style={td}>
                    {renderField('plaintiff', 'اسم المدعي...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                  <td style={th}>المدعى عليه</td>
                  <td style={td}>
                    {renderField('defendant', 'اسم المدعى عليه...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                </tr>
                <tr>
                  <td style={th}>موضوع القضية</td>
                  <td style={td}>
                    {renderField('caseSubject', 'موضوع القضية...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                  <td style={th}>رقم القضية</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>
                    {renderField('caseNumber', 'رقم القضية...', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11.5px', fontFamily: 'monospace', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Lawyer Assignment ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', backgroundColor: '#ffffff' }}>
              <tbody>
                <tr>
                  <td style={{
                    ...th, width: '200px',
                    backgroundColor: '#3F4A2C',
                    color: '#ffffff',
                    borderColor: '#C9A449',
                  }}>
                    المحامي المسند إليه الجلسة
                  </td>
                  <td style={{
                    padding: '9px 12px',
                    border: '1px solid #C9A449',
                    backgroundColor: '#ffffff',
                  }}>
                    {renderField('lawyerName', 'ادخل اسم المحامي هنا...', { width: '100%', fontSize: '12.5px', color: '#4B4B4B', border: 'none', outline: 'none', background: 'transparent', fontWeight: '600' }, 'focus:outline-none')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Summary Box ── */}
            <div style={{
              border: '1.5px solid #C9A449',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '20px',
              backgroundColor: '#ffffff',
            }}>
              <div style={{
                backgroundColor: '#3F4A2C',
                color: '#ffffff',
                textAlign: 'center',
                fontWeight: '700',
                fontSize: '13px',
                padding: '8px 12px',
              }}>
                الملخص
              </div>
              <div style={{ padding: '16px', backgroundColor: '#ffffff' }}>
                {renderTextarea('summary', 8, 'اكتب هنا ملخص ما دار في الجلسة بالتفصيل...', {
                  width: '100%', fontSize: '12.5px', lineHeight: '1.8',
                  color: '#4B4B4B', minHeight: '180px',
                  border: '1px solid #E5E5E5',
                  borderRadius: '6px', padding: '10px', outline: 'none',
                  resize: 'vertical', background: 'transparent',
                  boxSizing: 'border-box',
                })}
                <div style={{
                  textAlign: 'left', fontSize: '11.5px', fontWeight: '700',
                  color: '#3F4A2C', paddingLeft: '12px', marginTop: '10px',
                  paddingTop: '8px', borderTop: '1px solid #E5E5E5',
                }}>
                  تفضلوا بقبول وافر الاحترام والتقدير،،،
                </div>
                <div style={{
                  textAlign: 'center', fontSize: '9.5px', color: '#666666',
                  paddingTop: '8px', marginTop: '8px',
                  lineHeight: '1.6',
                }}>
                  عدم تقديمكم لأي اعتراض على هذه الإفادة إلى مكتب محمد العي للمحاماة خلال ثلاث أيام من وصولها لكم يعد موافقة منكم على مضمونها
                </div>
              </div>
            </div>

            {/* ── Next Session & Actions Table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', backgroundColor: '#ffffff' }}>
              <tbody>
                {/* Next session row */}
                <tr>
                  <td style={{
                    ...th, width: '22%',
                    backgroundColor: '#3F4A2C',
                    color: '#ffffff',
                    borderColor: '#C9A449',
                  }} rowSpan={1}>موعد الجلسة القادمة</td>
                  <td style={th}>التاريخ</td>
                  <td style={td}>
                    {renderField('nextSessionDate', 'YYYY-MM-DD', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11px', fontFamily: 'monospace', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                  <td style={th}>اليوم</td>
                  <td style={td}>
                    <span style={{ fontSize: '11px', color: '#4B4B4B', fontWeight: '600' }}>
                      {getNextSessionDay()}
                    </span>
                  </td>
                  <td style={th}>الساعة</td>
                  <td style={td}>
                    {renderField('nextSessionTime', '00:00', { width: '100%', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: '11px', color: '#4B4B4B', fontWeight: '600' })}
                  </td>
                </tr>
                {/* Our action row */}
                <tr>
                  <td style={{
                    ...th, width: '22%',
                    backgroundColor: '#3F4A2C',
                    color: '#ffffff',
                    borderColor: '#C9A449',
                  }}>الإجراء المطلوب من قبلنا</td>
                  <td colSpan={6} style={{ ...td, textAlign: 'right', padding: '6px 10px' }}>
                    {renderTextarea('ourActionRequired', 2, 'ادخل الإجراءات المطلوبة من فريق المحاماة...', {
                      width: '100%', fontSize: '12px', color: '#4B4B4B', background: 'transparent',
                      border: '1px solid #E5E5E5',
                      borderRadius: '4px', padding: '4px 8px', outline: 'none', resize: 'none',
                      boxSizing: 'border-box', direction: 'rtl', textAlign: 'right',
                    })}
                  </td>
                </tr>
                {/* Client action row */}
                <tr>
                  <td style={{
                    ...th, width: '22%',
                    backgroundColor: '#3F4A2C',
                    color: '#ffffff',
                    borderColor: '#C9A449',
                  }}>الإجراء المطلوب من قبلكم</td>
                  <td colSpan={6} style={{ ...td, textAlign: 'right', padding: '6px 10px' }}>
                    {renderTextarea('clientActionRequired', 2, 'ادخل الإجراءات أو المستندات المطلوبة من العميل...', {
                      width: '100%', fontSize: '12px', color: '#4B4B4B', background: 'transparent',
                      border: '1px solid #E5E5E5',
                      borderRadius: '4px', padding: '4px 8px', outline: 'none', resize: 'none',
                      boxSizing: 'border-box', direction: 'rtl', textAlign: 'right',
                    })}
                  </td>
                </tr>
              </tbody>
            </table>

          </div>

          {/* ── Footer Banner ── */}
          <div>
            <div style={{
              height: '4px',
              backgroundColor: '#C9A449',
              width: '100%',
            }} />
            <table style={{
              width: '100%',
              backgroundColor: '#3F4A2C',
              borderCollapse: 'collapse',
            }}>
              <tbody>
                <tr>
                  <td style={{
                    padding: '16px 20px', verticalAlign: 'middle',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                    width: '30%',
                  }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#ffffff' }}>
                      شريكك القانوني المعتمد
                    </div>
                    <div style={{
                      fontSize: '9px', color: '#C9A449', letterSpacing: '1px',
                      marginTop: '3px', textTransform: 'uppercase', fontWeight: '700',
                    }}>Your Trusted Legal Partner</div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <div style={{
                      display: 'flex', gap: '16px', justifyContent: 'center',
                      color: '#ffffff', fontSize: '11px', flexWrap: 'wrap', fontWeight: '600',
                    }}>
                      <span>🌐 mohdalay.com</span>
                      <span>✉️ office@mahdalay.com</span>
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 20px', textAlign: 'right', verticalAlign: 'middle',
                    fontSize: '10px', color: '#E5E5E5', lineHeight: '1.6',
                    width: '25%',
                  }}>
                    جدة، طريق الملك فهد 7746<br />
                    Jeddah, King Fahad Rd 7746
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
