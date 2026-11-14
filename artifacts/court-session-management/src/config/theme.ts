/**
 * نظام الألوان المعتمد للمنصة (Platform Design System Colors)
 * ─────────────────────────────────────────────────────────────
 * الهوية البصرية الرسمية للأنظمة القانونية الفاخرة (Premium Legal-Tech SaaS):
 * - Primary Navy:    #14263A (الكحلي الأساسي للشريط الجانبي وشريط التنقل)
 * - Secondary Navy:  #253B52 (الكحلي الثانوي للعناصر والطبقات)
 * - Gold Accent:     #C49A45 (الذهبي الفاخر للعناصر النشطة والمؤشرات الحيوية)
 * - Light Gold:      #E8C477 (الذهبي الناعم للمؤشرات الثانوية والتدرجات)
 * - Light Background:#F5F6F8 (خلفية النظام الفاتحة المريحة للعين)
 * - White Surface:   #FFFFFF (الأسطح والبطاقات البيضاء النقية)
 * - Muted Text:      #8B9AAF (النصوص والرموز الفرعية المريحة)
 */

export const THEME_COLORS = {
  // 1. الألوان الأساسية المعتمدة
  primaryNavy: '#14263A',
  secondaryNavy: '#253B52',
  primaryGold: '#C49A45',
  lightGold: '#E8C477',
  mutedText: '#8B9AAF',

  // 2. ألوان الأسطح والخلفيات
  systemBg: '#F5F6F8',
  cardBg: '#FFFFFF',
  fieldBorder: '#E5E7EB',
  textPrimary: '#14263A',
  textSecondary: '#8B9AAF',
  goldBg: '#FFF4DE',

  // توافق مع الكود القائم
  deepNavy: '#0F1E2E',
} as const;

export type ThemeColorName = keyof typeof THEME_COLORS;
