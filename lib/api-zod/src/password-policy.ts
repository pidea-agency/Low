export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  HELPER_TEXT_AR: "يجب أن تتكون من 8 خانات على الأقل، وتحتوي على حرف ورقم واحد على الأقل، وألا تكون شائعة أو مطابقة لاسم المستخدم.",
} as const;

export type PasswordValidationReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "MISSING_LETTER"
  | "MISSING_DIGIT"
  | "COMMONLY_USED"
  | "EQUALS_USERNAME"
  | "EQUALS_EMAIL";

export interface PasswordValidationResult {
  isValid: boolean;
  reason?: PasswordValidationReason;
  message?: string;
}

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "admin123",
  "admin1234",
  "11111111",
  "00000000",
  "123123123",
  "welcome1",
  "pass1234",
  "lawyer123",
]);

/**
 * Validates a password against the unified system password policy.
 *
 * Rules:
 * - 8 to 128 characters
 * - At least one letter (Latin or Arabic)
 * - At least one digit (0-9 or Arabic-Indic digits)
 * - Rejects commonly used weak passwords
 * - Rejects passwords identical to username or email
 */
export function validatePassword(
  password: string | undefined | null,
  context?: { username?: string | null; email?: string | null },
): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return {
      isValid: false,
      reason: "TOO_SHORT",
      message: "كلمة المرور يجب ألا تقل عن 8 خانات.",
    };
  }

  const trimmed = password.trim();

  if (trimmed.length < PASSWORD_POLICY.MIN_LENGTH) {
    return {
      isValid: false,
      reason: "TOO_SHORT",
      message: `كلمة المرور يجب ألا تقل عن ${PASSWORD_POLICY.MIN_LENGTH} خانات.`,
    };
  }

  if (trimmed.length > PASSWORD_POLICY.MAX_LENGTH) {
    return {
      isValid: false,
      reason: "TOO_LONG",
      message: `كلمة المرور يجب ألا تتجاوز ${PASSWORD_POLICY.MAX_LENGTH} خانة.`,
    };
  }

  // Check for at least one letter (Latin or Arabic)
  const hasLetter = /[\p{L}]/u.test(trimmed);
  if (!hasLetter) {
    return {
      isValid: false,
      reason: "MISSING_LETTER",
      message: "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل (عربي أو إنجليزي).",
    };
  }

  // Check for at least one digit (ASCII or Arabic-Indic)
  const hasDigit = /[\d\u0660-\u0669\u06F0-\u06F9]/.test(trimmed);
  if (!hasDigit) {
    return {
      isValid: false,
      reason: "MISSING_DIGIT",
      message: "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.",
    };
  }

  // Reject common passwords
  const lower = trimmed.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      isValid: false,
      reason: "COMMONLY_USED",
      message: "كلمة المرور هذه شائعة جداً وسهلة التخمين، يرجى اختيار كلمة مرور أكثر أماناً.",
    };
  }

  // Reject password equal to username
  if (context?.username) {
    const cleanUsername = context.username.trim().toLowerCase();
    if (cleanUsername && lower === cleanUsername) {
      return {
        isValid: false,
        reason: "EQUALS_USERNAME",
        message: "لا يمكن أن تكون كلمة المرور مطابقة لاسم المستخدم.",
      };
    }
  }

  // Reject password equal to email or email prefix
  if (context?.email) {
    const cleanEmail = context.email.trim().toLowerCase();
    const emailPrefix = cleanEmail.split("@")[0];
    if ((cleanEmail && lower === cleanEmail) || (emailPrefix && lower === emailPrefix)) {
      return {
        isValid: false,
        reason: "EQUALS_EMAIL",
        message: "لا يمكن أن تكون كلمة المرور مطابقة للبريد الإلكتروني.",
      };
    }
  }

  return { isValid: true };
}

