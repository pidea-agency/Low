/**
 * Lightweight Hijri ↔ Gregorian conversion for the frontend.
 * Uses `moment-hijri` to ensure strict Umm al-Qura calendar accuracy.
 */

import moment from 'moment-hijri';

export interface HijriDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

export const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const HIJRI_FORMATS = [
  'iDD/iMM/iYYYY',
  'iD/iM/iYYYY',
  'iDD-iMM-iYYYY',
  'iD-iM-iYYYY',
  'iYYYY/iMM/iDD',
  'iYYYY/iM/iD',
  'iYYYY-iMM-iDD',
  'iYYYY-iM-iD',
];

/**
 * Returns the Arabic day name (e.g. الخميس, الأحد) for a session.
 */
export function getArabicDayName(session: {
  sessionDay?: string | null;
  hearingAt?: string | null;
  sessionDateHijri?: string | null;
}): string | null {
  if (session.sessionDay && session.sessionDay !== '—' && session.sessionDay.trim() !== '') {
    return session.sessionDay;
  }

  if (session.hearingAt) {
    const d = new Date(session.hearingAt);
    if (!isNaN(d.getTime())) {
      // Mecca time offset UTC+3
      const meccaDate = new Date(d.getTime() + 3 * 3600 * 1000);
      return ARABIC_DAYS[meccaDate.getUTCDay()] ?? null;
    }
  }

  if (session.sessionDateHijri) {
    const raw = session.sessionDateHijri.trim();
    for (const fmt of HIJRI_FORMATS) {
      try {
        const m = moment(raw, fmt, true);
        if (m && typeof m.isValid === 'function' && m.isValid()) {
          return ARABIC_DAYS[m.day()] ?? null;
        }
      } catch {
        // ignore format mismatch
      }
    }
    for (const fmt of HIJRI_FORMATS) {
      try {
        const m = moment(raw, fmt);
        if (m && typeof m.isValid === 'function' && m.isValid()) {
          return ARABIC_DAYS[m.day()] ?? null;
        }
      } catch {
        // ignore
      }
    }

    // Gregorian format fallback (e.g. Palestinian/Jordanian/Egyptian courts)
    const GREG_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY/MM/DD', 'DD-MM-YYYY'];
    for (const fmt of GREG_FORMATS) {
      try {
        const m = moment(raw, fmt, true);
        if (m && typeof m.isValid === 'function' && m.isValid()) {
          return ARABIC_DAYS[m.day()] ?? null;
        }
      } catch {}
    }
  }

  return null;
}


/** Convert a JS Date to its Hijri equivalent (uses UTC date components). */
export function dateToHijri(date: Date): HijriDate {
  const m = moment([date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()]);
  return {
    year: m.iYear(),
    month: m.iMonth() + 1,
    day: m.iDate(),
  };
}

/** Current Hijri date in Mecca time (Asia/Makkah = UTC+3). */
export function nowHijri(): HijriDate {
  const meccaNow = new Date(Date.now() + 3 * 3600 * 1000);
  return dateToHijri(meccaNow);
}

/** Format a HijriDate as "DD/MM/YYYY هـ". */
export function formatHijri(h: HijriDate): string {
  const dd = String(h.day).padStart(2, '0');
  const mm = String(h.month).padStart(2, '0');
  return `${dd}/${mm}/${h.year} هـ`;
}

/** Format a HijriDate as "DD شهر YYYY هـ" in full Arabic. */
export function formatHijriLong(h: HijriDate): string {
  const monthName = HIJRI_MONTHS_AR[h.month - 1] ?? '';
  return `${h.day} ${monthName} ${h.year} هـ`;
}

export interface TimeRemaining {
  totalMs: number;      // negative = past
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isToday: boolean;     // same Hijri day
}

/**
 * Compute how much time remains until `hearingAt` (ISO string).
 * Returns null if hearingAt is null/undefined/invalid.
 */
export function computeTimeRemaining(hearingAt: string | null | undefined): TimeRemaining | null {
  if (!hearingAt) return null;
  const target = new Date(hearingAt).getTime();
  if (isNaN(target)) return null;

  const now = Date.now();
  const totalMs = target - now;
  const absTotalMs = Math.abs(totalMs);

  const totalSeconds = Math.floor(absTotalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // isToday: same Hijri day as current Mecca date (UTC+3)
  const targetHijri = dateToHijri(new Date(target + 3 * 3600 * 1000)); // UTC+3 shift for Mecca time
  const currentHijri = nowHijri();
  const isToday =
    targetHijri.year === currentHijri.year &&
    targetHijri.month === currentHijri.month &&
    targetHijri.day === currentHijri.day;

  return { totalMs, days, hours, minutes, seconds, isPast: totalMs < 0, isToday };
}

/**
 * Derives the effective status of a session based on stored status and hearing time.
 */
export function deriveEffectiveStatus(
  storedStatus: 'Upcoming' | 'Today' | 'Finished' | 'Cancelled' | string,
  hearingAt: string | null | undefined,
): 'Upcoming' | 'Today' | 'Finished' | 'Cancelled' {
  if (storedStatus === 'Cancelled' || storedStatus === 'Finished') return storedStatus;
  if (!hearingAt) return (storedStatus as any) || 'Upcoming';
  const hearing = new Date(hearingAt);
  if (isNaN(hearing.getTime())) return (storedStatus as any) || 'Upcoming';
  const now = new Date();
  if (hearing.getTime() < now.getTime()) return 'Finished';
  const sameDay =
    hearing.getUTCFullYear() === now.getUTCFullYear() &&
    hearing.getUTCMonth() === now.getUTCMonth() &&
    hearing.getUTCDate() === now.getUTCDate();
  if (sameDay) return 'Today';
  return 'Upcoming';
}

