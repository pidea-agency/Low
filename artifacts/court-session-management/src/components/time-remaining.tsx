import { useEffect, useState } from 'react';
import { computeTimeRemaining, nowHijri, formatHijri, formatHijriLong, type TimeRemaining } from '@/lib/hijri';
import { Clock, CheckCircle2, AlertTriangle, CalendarDays } from 'lucide-react';

interface TimeRemainingBadgeProps {
  hearingAt: string | null | undefined;
  sessionDateHijri?: string | null;
  /** compact: one-line chip; full: multi-line card block */
  variant?: 'compact' | 'full';
}

function useCountdown(hearingAt: string | null | undefined) {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(() =>
    computeTimeRemaining(hearingAt),
  );

  useEffect(() => {
    if (!hearingAt) return;
    // Refresh every 30 seconds
    const id = setInterval(() => {
      setRemaining(computeTimeRemaining(hearingAt));
    }, 30_000);
    return () => clearInterval(id);
  }, [hearingAt]);

  return remaining;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function buildCountdownText(r: TimeRemaining): string {
  if (r.isPast) {
    if (r.days > 0) return `انتهت منذ ${r.days} يوم`;
    if (r.hours > 0) return `انتهت منذ ${r.hours} ساعة`;
    if (r.minutes > 0) return `انتهت منذ ${r.minutes} دقيقة`;
    return 'انتهت للتو';
  }
  if (r.days === 0 && r.hours === 0 && r.minutes === 0) return 'الآن';
  if (r.days > 0) {
    return `باقي ${r.days} يوم و ${pad(r.hours)} ساعة و ${pad(r.minutes)} دقيقة`;
  }
  if (r.hours > 0) {
    return `باقي ${r.hours} ساعة و ${pad(r.minutes)} دقيقة`;
  }
  return `باقي ${r.minutes} دقيقة`;
}

/** Single-line chip shown in session cards */
export function TimeRemainingBadge({ hearingAt, variant = 'compact' }: TimeRemainingBadgeProps) {
  const remaining = useCountdown(hearingAt);

  if (!remaining) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        لم يُحدَّد الوقت
      </span>
    );
  }

  const text = buildCountdownText(remaining);

  if (remaining.isPast) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {text}
      </span>
    );
  }

  if (remaining.isToday) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {text}
      </span>
    );
  }

  if (remaining.days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500 dark:text-orange-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {text}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      {text}
    </span>
  );
}

/** Live clock – ticks every second, always reflects Mecca time (UTC+3). */
function useLiveClock() {
  const getMeccaTime = () => {
    const now = new Date(Date.now() + 3 * 3600 * 1000); // shift to UTC+3
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const [time, setTime] = useState(getMeccaTime);

  useEffect(() => {
    const id = setInterval(() => setTime(getMeccaTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/** Full countdown block shown in session detail page */
export function TimeRemainingCard({ hearingAt }: { hearingAt: string | null | undefined }) {
  const remaining = useCountdown(hearingAt);
  const currentHijri = nowHijri();
  const liveTime = useLiveClock();

  const urgencyClass = !remaining
    ? 'border-border bg-muted/30'
    : remaining.isPast
    ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15'
    : remaining.isToday
    ? 'border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20'
    : remaining.days <= 3
    ? 'border-orange-400/60 bg-orange-50/60 dark:bg-orange-950/20'
    : 'border-primary/30 bg-primary/5';

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${urgencyClass}`}>
      {/* Current Hijri date + live clock */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span>التاريخ الهجري الحالي: <span className="font-medium text-foreground">{formatHijriLong(currentHijri)}</span></span>
        </div>
        {/* Live Mecca clock */}
        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground tabular-nums">
          <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span>{liveTime}</span>
        </div>
      </div>

      {!remaining ? (
        <div className="text-sm text-muted-foreground">لم يتم تحديد تاريخ أو وقت الجلسة</div>
      ) : remaining.isPast ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>الجلسة منتهية ومكتملة — {buildCountdownText(remaining)}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Countdown boxes */}
          <div className="flex gap-2 justify-center">
            <CountBox value={remaining.days} label="يوم" highlight={remaining.days === 0} />
            <span className="text-xl font-bold text-muted-foreground self-start pt-1">:</span>
            <CountBox value={remaining.hours} label="ساعة" highlight={remaining.days === 0} />
            <span className="text-xl font-bold text-muted-foreground self-start pt-1">:</span>
            <CountBox value={remaining.minutes} label="دقيقة" highlight={remaining.days === 0 && remaining.hours === 0} />
          </div>

          {/* Urgency label */}
          <div className="text-center">
            {remaining.isToday ? (
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                ⚠ الجلسة اليوم — {buildCountdownText(remaining)}
              </span>
            ) : remaining.days <= 3 ? (
              <span className="text-sm font-medium text-orange-500 dark:text-orange-400">
                {buildCountdownText(remaining)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {buildCountdownText(remaining)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function CountBox({ value, label, highlight }: { value: number; label: string; highlight: boolean }) {
  return (
    <div className={`flex flex-col items-center min-w-[52px] rounded-md px-3 py-2 ${
      highlight ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-background/80 border border-border'
    }`}>
      <span className={`text-2xl font-bold font-mono tabular-nums leading-none ${
        highlight ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'
      }`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}
