import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useListSessions, useGetCurrentUser, type Session } from '@workspace/api-client-react';
import { getStoredPoaRecords } from '@/lib/poa-storage';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { Search, Scale, FileText, ArrowLeft, ShieldCheck } from 'lucide-react';
import { getArabicDayName } from '@/lib/hijri';
import { getNavItemsForRole } from '@/config/navigation';

interface GlobalSearchProps {
  /** Optional custom trigger render or trigger button class */
  className?: string;
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: sessions = [] } = useListSessions();
  const { data: currentUser } = useGetCurrentUser();
  const userId = currentUser?.id || (currentUser as any)?.userId;
  const officeId = (currentUser as any)?.officeId || userId;
  const [poaRecords, setPoaRecords] = useState<any[]>([]);

  // Load POAs from isolated local storage when search opens
  useEffect(() => {
    if (open && officeId && userId) {
      const records = getStoredPoaRecords(officeId, userId);
      if (records) setPoaRecords(records);
    }
  }, [open, officeId, userId]);

  // Listen for Ctrl+K or Cmd+K shortcut globally
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer text-white/70 hover:text-white hover:bg-white/10 border border-white/10 bg-white/5 shadow-inner ${className || ''}`}
        data-testid="button-global-search-trigger"
        aria-label="البحث السريع في النظام"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>البحث السريع...</span>
        </div>
        <Kbd className="bg-white/15 text-white border-none font-mono text-[10px] px-1.5 py-0.5">
          Ctrl K
        </Kbd>
      </button>

      {/* Command Palette Search Modal */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div dir="rtl" className="flex flex-col overflow-hidden">
          <CommandInput
            placeholder="ابحث برقم القضية، الوكالات، الأحكام، المهام، اسم المحكمة، أو الأطراف..."
            className="text-sm font-medium"
            data-testid="input-global-search"
          />

          <CommandList className="max-h-[380px] p-2 space-y-2">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              لم يتم العثور على أي نتائج مطابقة
            </CommandEmpty>

            {/* Quick Navigation Pages - Filtered strictly by role */}
            <CommandGroup heading="أقسام النظام والتنقل السريع">
              {getNavItemsForRole(currentUser?.role).map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.keywords}`}
                    onSelect={() => handleSelect(item.path)}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">{item.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{item.path}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* Direct Sessions Results */}
            {Array.isArray(sessions) && sessions.length > 0 && (
              <CommandGroup heading="الجلسات القضائية">
                {sessions.map((session: Session) => {
                  const dayName = getArabicDayName(session);
                  const title = session.caseNumber ? `قضية رقم ${session.caseNumber}` : `جلسة #${session.id}`;
                  const details = [
                    session.plaintiff && `المدعي: ${session.plaintiff}`,
                    session.defendant && `المدعى عليه: ${session.defendant}`,
                    session.court && `المحكمة: ${session.court}`,
                    session.sessionDateHijri && `التاريخ: ${dayName ? dayName + ' ' : ''}${session.sessionDateHijri}`,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <CommandItem
                      key={`session-${session.id}`}
                      value={`${session.caseNumber || ''} ${session.plaintiff || ''} ${session.defendant || ''} ${session.court || ''} ${session.courtCircuit || ''} ${session.caseSubject || ''}`}
                      onSelect={() => handleSelect(`/sessions/${session.id}`)}
                      className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                      data-testid={`search-item-session-${session.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Scale className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span className="font-mono">{title}</span>
                            {session.status && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                {session.status === 'Today' ? 'اليوم' : session.status === 'Finished' ? 'منتهية' : 'قادمة'}
                              </span>
                            )}
                          </div>
                          {details && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {details}
                            </p>
                          )}
                        </div>
                      </div>
                      <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Direct Wakala / POA Results */}
            {poaRecords.length > 0 && (
              <CommandGroup heading="الوكالات الشرعية">
                {poaRecords.map((poa: any) => (
                  <CommandItem
                    key={`poa-${poa.id || poa.poaNumber}`}
                    value={`وكالة ${poa.clientName || ''} ${poa.poaNumber || ''} ${poa.notes || ''}`}
                    onSelect={() => handleSelect('/poa')}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          وكالة: {poa.clientName || 'عميل غير محدد'}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                          رقم: {poa.poaNumber || '—'} {poa.expiryDateHijri ? `· تنتهي: ${poa.expiryDateHijri}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">عرض الوكالات ←</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Direct Session Reports Results */}
            {Array.isArray(sessions) && sessions.length > 0 && (
              <CommandGroup heading="تقارير الجلسات">
                {sessions.map((session: Session) => (
                  <CommandItem
                    key={`report-${session.id}`}
                    value={`تقرير ${session.caseNumber || ''} ${session.plaintiff || ''} ${session.court || ''}`}
                    onSelect={() => handleSelect(`/reports/${session.id}`)}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                    data-testid={`search-item-report-${session.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          تقرير الجلسة {session.caseNumber ? `(قضية ${session.caseNumber})` : `#${session.id}`}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {session.court || 'المحكمة غير محددة'} {session.sessionDateHijri ? `· ${session.sessionDateHijri}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-primary font-medium">عرض التقرير ←</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* Footer Shortcuts hint */}
          <div className="p-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground bg-muted/40">
            <div className="flex items-center gap-2">
              <span>استخدم الأسهم للتنقل</span>
              <span>·</span>
              <span><Kbd>Enter</Kbd> للاختيار</span>
            </div>
            <span><Kbd>Esc</Kbd> للإغلاق</span>
          </div>
        </div>
      </CommandDialog>
    </>
  );
}
