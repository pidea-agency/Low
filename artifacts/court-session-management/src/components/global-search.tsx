import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import {
  Search,
  Scale,
  ShieldCheck,
  Gavel,
  CheckSquare,
  Users,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { getArabicDayName } from '@/lib/hijri';
import { getNavItemsForRole } from '@/config/navigation';

interface GlobalSearchProps {
  /** Optional custom trigger render or trigger button class */
  className?: string;
}

interface SearchResults {
  clients: any[];
  poa: any[];
  judgments: any[];
  sessions: any[];
  tasks: any[];
}

const emptyResults: SearchResults = {
  clients: [],
  poa: [],
  judgments: [],
  sessions: [],
  tasks: [],
};

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search query by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results whenever debouncedQuery changes
  useEffect(() => {
    if (!open) return;

    if (!debouncedQuery) {
      setResults(emptyResults);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Search failed');
        }
        return res.json();
      })
      .then((data: SearchResults) => {
        setResults({
          clients: data.clients || [],
          poa: data.poa || [],
          judgments: data.judgments || [],
          sessions: data.sessions || [],
          tasks: data.tasks || [],
        });
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Global search error:', err);
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, open]);

  // Reset state when dialog is closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setResults(emptyResults);
      setIsLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [open]);

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

  const navItems = getNavItemsForRole(currentUser?.role);
  const filteredNavItems = debouncedQuery
    ? navItems.filter((item) =>
        `${item.name} ${item.keywords || ''}`.toLowerCase().includes(debouncedQuery.toLowerCase()),
      )
    : navItems;

  const totalResultsCount =
    results.clients.length +
    results.poa.length +
    results.judgments.length +
    results.sessions.length +
    results.tasks.length;

  const hasAnyMatches = filteredNavItems.length > 0 || totalResultsCount > 0;

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
          <Search className="w-3.5 h-3.5 shrink-0 text-[#C99732]" />
          <span>البحث السريع...</span>
        </div>
        <Kbd className="bg-white/15 text-white border-none font-mono text-[10px] px-1.5 py-0.5">
          Ctrl K
        </Kbd>
      </button>

      {/* Command Palette Search Modal */}
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <div dir="rtl" className="flex flex-col overflow-hidden">
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="ابحث برقم القضية، العميل، الوكالة، الحكم، المهمة..."
              className="text-sm font-medium pr-3 pl-9"
              data-testid="input-global-search"
            />
            {isLoading && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C99732]" />
              </div>
            )}
          </div>

          <CommandList className="max-h-[380px] p-2 space-y-2">
            {!isLoading && !hasAnyMatches && (
              <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                  <Search className="w-5 h-5 text-muted-foreground" />
                </div>
                لم يتم العثور على أي نتائج مطابقة
              </CommandEmpty>
            )}

            {/* Quick Navigation Pages */}
            {filteredNavItems.length > 0 && (
              <CommandGroup heading="أقسام النظام والتنقل السريع">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={`nav-${item.id}`}
                      value={`nav-${item.id}`}
                      onSelect={() => handleSelect(item.path)}
                      className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between hover:bg-accent transition-colors"
                      data-testid={`search-item-nav-${item.id}`}
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
            )}

            {/* Clients Results */}
            {results.clients.length > 0 && (
              <CommandGroup heading="العملاء والموكلون">
                {results.clients.map((client: any) => (
                  <CommandItem
                    key={`client-${client.id}`}
                    value={`client-${client.id}`}
                    onSelect={() => handleSelect(`/clients/${client.id}`)}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                    data-testid={`search-item-client-${client.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">
                          {client.name}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                          {client.phone ? `هاتف: ${client.phone}` : ''}
                          {client.phone && client.notes ? ' · ' : ''}
                          {client.notes || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-600 font-medium shrink-0">
                      <span>عرض الملف</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Sessions Results */}
            {results.sessions.length > 0 && (
              <CommandGroup heading="الجلسات القضائية">
                {results.sessions.map((session: any) => {
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
                      value={`session-${session.id}`}
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

            {/* POA Results */}
            {results.poa.length > 0 && (
              <CommandGroup heading="الوكالات الشرعية">
                {results.poa.map((poa: any) => (
                  <CommandItem
                    key={`poa-${poa.id}`}
                    value={`poa-${poa.id}`}
                    onSelect={() => handleSelect('/poa')}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                    data-testid={`search-item-poa-${poa.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">
                          وكالة: {poa.clientName || 'عميل غير محدد'}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                          رقم: {poa.poaNumber || '—'} {poa.expiryDateHijri ? `· تنتهي: ${poa.expiryDateHijri}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                      <span>عرض الوكالات</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Judgments Results */}
            {results.judgments.length > 0 && (
              <CommandGroup heading="الأحكام القضائية">
                {results.judgments.map((judgment: any) => (
                  <CommandItem
                    key={`judgment-${judgment.id}`}
                    value={`judgment-${judgment.id}`}
                    onSelect={() => handleSelect('/judgments')}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                    data-testid={`search-item-judgment-${judgment.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Gavel className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate flex items-center gap-2">
                          <span>قضية: {judgment.caseNumber || 'غير محدد'}</span>
                          {judgment.isFavorable && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                              {judgment.isFavorable}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {judgment.court ? `المحكمة: ${judgment.court}` : ''}
                          {judgment.judgmentNumber ? ` · رقم الحكم: ${judgment.judgmentNumber}` : ''}
                          {judgment.plaintiff ? ` · المدعي: ${judgment.plaintiff}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-medium shrink-0">
                      <span>عرض الأحكام</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Tasks Results */}
            {results.tasks.length > 0 && (
              <CommandGroup heading="المهام اليومية">
                {results.tasks.map((task: any) => (
                  <CommandItem
                    key={`task-${task.id}`}
                    value={`task-${task.id}`}
                    onSelect={() => handleSelect('/tasks')}
                    className="cursor-pointer p-2.5 rounded-lg flex items-center justify-between gap-3 hover:bg-accent transition-colors"
                    data-testid={`search-item-task-${task.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate flex items-center gap-2">
                          <span>{task.title}</span>
                          {task.status && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-300/40">
                              {task.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {task.dueDate ? `تاريخ الاستحقاق: ${task.dueDate}` : ''}
                          {task.priority ? ` · الأولوية: ${task.priority}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-medium shrink-0">
                      <span>عرض المهام</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
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
