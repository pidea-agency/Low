/**
 * نظام الألوان المعتمد للمنصة (Platform Design System Colors)
 * ─────────────────────────────────────────────────────────────
 * 1. الألوان الأساسية (Primary Colors):
 *    - الكحلي الأساسي (Primary Navy): #0B2A4A — القائمة الجانبية، شريط التنقل، العناوين البارزة
 *    - الكحلي الغامق (Deep Navy):    #071D34 — الخلفيات الداكنة والتدرجات
 *    - الذهبي الأساسي (Primary Gold): #C99732 — الأزرار الرئيسية، العناصر النشطة، الأيقونات المهمة
 *    - الذهبي الفاتح (Light Gold):   #E8C477 — التدرجات واللمسات الثانوية
 *
 * 2. الألوان المساعدة والخلفيات (Secondary & Background Colors):
 *    - خلفية النظام (System Background): #F5F7FB
 *    - البطاقات (Cards):               #FFFFFF
 *    - حدود الحقول (Field Borders):      #D6E0EC
 *    - النص الأساسي (Primary Text):      #10233F
 *    - النص الثانوي (Secondary Text):    #64748B
 *    - خلفية ذهبية (Gold Tint BG):       #FFF4DE
 */

export const THEME_COLORS = {
  // 1. الألوان الأساسية
  primaryNavy: '#0B2A4A',
  deepNavy: '#071D34',
  primaryGold: '#C99732',
  lightGold: '#E8C477',

  // 2. الألوان المساعدة والخلفيات
  systemBg: '#F5F7FB',
  cardBg: '#FFFFFF',
  fieldBorder: '#D6E0EC',
  textPrimary: '#10233F',
  textSecondary: '#64748B',
  goldBg: '#FFF4DE',
} as const;

export type ThemeColorName = keyof typeof THEME_COLORS;
