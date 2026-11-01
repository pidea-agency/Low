import { HfInference } from "@huggingface/inference";
import { getSettings } from "../config/settings-store";
import { logger } from "../lib/logger";
import {
  SESSION_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "../prompts/extraction.prompt";
import type { SessionExtraction } from "@workspace/api-client-react";

export class AiExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiExtractionError";
  }
}

export class InsufficientSessionDataError extends Error {
  constructor(message = "لا توجد بيانات جلسة كافية في النص المدخل. يرجى التأكد من إدخال نص إشعار جلسة قضائية صالح.") {
    super(message);
    this.name = "InsufficientSessionDataError";
  }
}

/** Checks whether a message is explicitly non-judicial or negated */
export function isNonJudicialOrNegated(message: string): boolean {
  const trimmed = message.trim();
  // Check explicit negation phrases
  if (/(?:ليست|ليس|غير|لا\s+تحتوي|ولا\s+تحتوي|لا\s+يوجد|بدون)\s+(?:رسالة\s+محكمة|قضية|جلسة|موعد)/i.test(trimmed)) {
    return true;
  }
  // Check if message lacks any legal/judicial keywords
  const judicialKeywords = /(?:دعوى|قضية|جلسة|محكمة|صك|دائرة|مدعي|مدعى\s+عليه|حضور|موعد|استئناف|بداية|صلح|تنفيذ|مرافعة|نطق|حكم)/i;
  if (!judicialKeywords.test(trimmed)) {
    return true;
  }
  return false;
}

/** Checks whether extracted data has minimum required fields to constitute a court session */
export function hasSufficientSessionData(data: SessionExtraction): boolean {
  const hasCase = Boolean(data.case_number && data.case_number.trim().length > 0);
  const hasCourt = Boolean(data.court && data.court.trim().length > 0);
  const hasDate = Boolean(data.session_date_hijri && data.session_date_hijri.trim().length > 0);
  const hasParties = Boolean(
    (data.plaintiff && data.plaintiff.trim().length > 0) ||
    (data.defendant && data.defendant.trim().length > 0)
  );
  const hasTime = Boolean(data.session_time && data.session_time.trim().length > 0);

  // Must have case_number, or (court + date), or (court + parties), or (date + time)
  return hasCase || (hasCourt && hasDate) || (hasCourt && hasParties) || (hasDate && hasTime);
}

/**
 * Smart rule-based Arabic court SMS extractor fallback.
 * Works immediately when an external AI provider key is not yet set or during network outages.
 */
function extractWithRules(message: string): SessionExtraction {
  const result: SessionExtraction = {
    case_number: null,
    plaintiff: null,
    defendant: null,
    court: null,
    court_circuit: null,
    case_subject: null,
    session_type: null,
    session_date_hijri: null,
    session_time: null,
    notes: null,
  };

  if (isNonJudicialOrNegated(message)) {
    return result;
  }

  // Case Number: e.g. "دعوى رقم 1234/2026" or "قضية رقم 4521"
  const caseMatch = message.match(/(?:دعوى|قضية|طلب|ملف)?\s*(?:رقم|الرقم)[:\s]+([0-9\/\-]+)/);
  if (caseMatch) result.case_number = caseMatch[1].trim();

  // Court name: e.g. "محكمة بداية عمان" or "محكمة الاستئناف" or "محكمة صلح شمال عمان"
  const courtMatch = message.match(/(?:لدى\s+|في\s+)?(محكمة\s+[^\n،,.]+?(?=\s+الدائرة|\s+بين|\s+ضد|\s+بتاريخ|\s+يوم|[،,.\n]|$))/);
  if (courtMatch) {
    const candidate = courtMatch[1].trim();
    // Validate candidate: must NOT contain negation words or casual conversational text
    if (!/(?:ليست|ليس|لا\s+تحتوي|ولا\s+تحتوي|غير|بدون|مرحباً|كيف\s+حالك|اختبار)/i.test(candidate)) {
      result.court = candidate.replace(/[\s\-_–—]+$/, "");
    }
  }

  // Court Circuit: e.g. "الدائرة الخامسة" or "دائرة التنفيذ"
  const circuitMatch = message.match(/(?:الدائرة|دائرة)\s+([^\n،,.]+?(?=\s+بين|\s+ضد|\s+بتاريخ|\s+يوم|[،,.\n]|$))/);
  if (circuitMatch) result.court_circuit = `الدائرة ${circuitMatch[1].trim()}`;

  // Plaintiff: e.g. "المدعي: أحمد خالد" or "بين المدعي أحمد"
  const plaintiffMatch = message.match(/(?:المدعي|المحيل|المستدعي)[:\s]+([^\n،,.]+?)(?=\s+و?(?:المدعى|المحال|المستدعى\s+ضده)|\s+ضد|\s+بتاريخ|\s+يوم|[،,.\n]|$)/);
  if (plaintiffMatch) result.plaintiff = plaintiffMatch[1].trim();

  // Defendant: e.g. "المدعى عليه: شركة النور"
  const defendantMatch = message.match(/(?:المدعى\s+عليه|المحال\s+إليه|المستدعى\s+ضده)[:\s]+([^\n،,.]+?)(?=\s+هو|\s+بتاريخ|\s+يوم|\s+الساعة|[،,.\n]|$)/);
  if (defendantMatch) result.defendant = defendantMatch[1].trim();

  // Date: e.g. "1448/03/12" or "2026-10-25" or "12-10-2026"
  const dateMatch = message.match(/(?:بتاريخ|يوم)\s+[^\d]*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
  if (dateMatch) {
    result.session_date_hijri = dateMatch[1].trim().replace(/-/g, "/");
  }

  // Time: e.g. "الساعة 10:30" or "09:00 صباحاً"
  const timeMatch = message.match(/(?:الساعة|في\s+تمام\s+الساعة)[:\s]*([0-9]{1,2}:[0-9]{2}(?:\s*(?:صباحاً|مساءً|ص|م))?)/);
  if (timeMatch) result.session_time = timeMatch[1].trim();

  // Session Type: e.g. "مرافعة" or "نطق بالحكم" or "استماع شهود"
  const typeMatch = message.match(/(مرافعة|جلسة\s+استماع|نطق\s+بالحكم|تحقيق|شهادة|قرار|جلسة\s+أولى)/);
  if (typeMatch) result.session_type = typeMatch[1].trim();

  // Case Subject: e.g. "موضوع الدعوى: مطالبة مالية"
  const subjectMatch = message.match(/(?:موضوع\s+الدعوى|الموضوع)[:\s]+([^\n،,.]+)/);
  if (subjectMatch) result.case_subject = subjectMatch[1].trim();

  result.notes = "تم الاستخراج والتحليل الفوري من نص الرسالة القضائية.";
  return result;
}

/**
 * Sends a raw court SMS message to the Admin's AI API (or falls back to smart regex)
 * while enforcing per-user quota isolation.
 */
export async function analyzeCourtMessage(
  message: string,
  userId?: string,
): Promise<SessionExtraction & { ai_usage_count?: number; ai_quota_limit?: number; plan_tier?: string }> {
  // ── 1. Check and enforce isolated user quota ─────────────────────────────
  let userRecord: any = null;
  let quotaLimit = 50; // default Plus plan quota
  let currentUsage = 0;
  let userPlanTier = "plus";

  if (userId) {
    try {
      const { loadLocalUsers } = require("./supabase.service");
      const users = loadLocalUsers();
      userRecord = users.find((u: any) => u.id === userId || u.username === userId);
      if (userRecord) {
        userPlanTier = userRecord.plan_tier || (userRecord.role === "admin" ? "pro" : "plus");
        quotaLimit = userRecord.ai_quota_limit !== undefined
          ? userRecord.ai_quota_limit
          : (userPlanTier === "pro" ? 300 : 50);
        currentUsage = userRecord.ai_usage_count || 0;

        if (quotaLimit !== -1 && currentUsage >= quotaLimit) {
          throw new AiExtractionError(
            `تم استهلاك الحد المسموح به لتحليلات الذكاء الاصطناعي لباقة (${userPlanTier === "pro" ? "Pro" : "Plus"}) لهذا الشهر (${currentUsage}/${quotaLimit}). يرجى التواصل مع المشرف العام لتجديد الرصيد أو الترقية لباقة أعلى.`
          );
        }
      }
    } catch (err: any) {
      if (err instanceof AiExtractionError) throw err;
      logger.warn({ err }, "Could not check user AI quota, proceeding with analysis");
    }
  }

  // ── 2. Call the Master AI Provider configured by the Admin ────────────────
  const settings = getSettings();
  const openAiKey = settings.aiApiKey || process.env.AI_API_KEY;
  const hfToken = settings.hfApiToken || process.env.HF_API_TOKEN;

  let raw: string | undefined;

  // Option A: OpenRouter / OpenAI / Groq compatible API
  if (openAiKey) {
    try {
      const baseUrl = (settings.aiBaseUrl || process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
      const model = settings.aiModel || process.env.AI_MODEL || "qwen/qwen-2.5-7b-instruct";

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SESSION_EXTRACTION_SYSTEM_PROMPT },
            { role: "user", content: buildExtractionUserPrompt(message) },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
      });

      if (res.ok) {
        const json: any = await res.json();
        raw = json?.choices?.[0]?.message?.content;
      } else {
        const errText = await res.text();
        logger.warn({ errText, status: res.status }, "Admin AI API returned non-200, falling back");
      }
    } catch (err) {
      logger.warn({ err }, "Admin OpenAI/OpenRouter extraction failed, checking fallbacks");
    }
  }

  // Option B: Hugging Face API
  if (!raw && hfToken) {
    try {
      const hfModel = settings.hfModel || "meta-llama/Llama-3.1-8B-Instruct";
      const hf = new HfInference(hfToken);
      const response = await hf.chatCompletion({
        model: hfModel,
        messages: [
          { role: "system", content: SESSION_EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: buildExtractionUserPrompt(message) },
        ],
        parameters: { temperature: 0.1, max_new_tokens: 512 },
      });
      raw = response.choices[0]?.message?.content ?? undefined;
    } catch (err) {
      logger.warn({ err }, "Hugging Face AI extraction request failed");
    }
  }

  let result: SessionExtraction;

  // ── 3. Parse JSON or Fallback to Rule Extractor ───────────────────────────
  if (raw) {
    let jsonStr: string | null = null;
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) {
      jsonStr = mdMatch[1].trim();
    } else {
      const braceStart = raw.indexOf("{");
      const braceEnd = raw.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd > braceStart) {
        jsonStr = raw.substring(braceStart, braceEnd + 1).trim();
      }
    }

    try {
      const parsed = JSON.parse(jsonStr || raw) as Record<string, unknown>;
      const rulesFallback = extractWithRules(message);
      result = {
        case_number: (typeof parsed.case_number === "string" && parsed.case_number.trim()) || rulesFallback.case_number || null,
        plaintiff: (typeof parsed.plaintiff === "string" && parsed.plaintiff.trim()) || rulesFallback.plaintiff || null,
        defendant: (typeof parsed.defendant === "string" && parsed.defendant.trim()) || rulesFallback.defendant || null,
        court: (typeof parsed.court === "string" && parsed.court.trim()) || rulesFallback.court || null,
        court_circuit: (typeof parsed.court_circuit === "string" && parsed.court_circuit.trim()) || rulesFallback.court_circuit || null,
        case_subject: (typeof parsed.case_subject === "string" && parsed.case_subject.trim()) || rulesFallback.case_subject || null,
        session_type: (typeof parsed.session_type === "string" && parsed.session_type.trim()) || rulesFallback.session_type || null,
        session_date_hijri: (typeof parsed.session_date_hijri === "string" && parsed.session_date_hijri.trim()) || rulesFallback.session_date_hijri || null,
        session_time: (typeof parsed.session_time === "string" && parsed.session_time.trim()) || rulesFallback.session_time || null,
        notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim() : rulesFallback.notes || null,
      };
    } catch {
      logger.info("Falling back to rule-based parser after invalid AI JSON");
      result = extractWithRules(message);
    }
  } else {
    logger.info("Falling back to rule-based parser when AI raw response is unavailable");
    result = extractWithRules(message);
  }

  // ── 3.5 Validate message semantic validity and extracted fields ─────────
  if (isNonJudicialOrNegated(message) || !hasSufficientSessionData(result)) {
    throw new InsufficientSessionDataError(
      "لا توجد بيانات جلسة كافية في النص المدخل. يرجى التأكد من أن النص يحتوي على رقم قضية أو محكمة أو موعد جلسة."
    );
  }

  // ── 4. Increment user usage and persist ──────────────────────────────────
  if (userRecord && userId) {
    try {
      const { loadLocalUsers, saveLocalUsers } = require("./supabase.service");
      const users = loadLocalUsers();
      const u = users.find((x: any) => x.id === userRecord.id);
      if (u) {
        u.ai_usage_count = (u.ai_usage_count || 0) + 1;
        currentUsage = u.ai_usage_count;
        saveLocalUsers(users);
        logger.info({ userId, usage: u.ai_usage_count, quota: quotaLimit }, "User AI quota incremented");
      }
    } catch (err) {
      logger.warn({ err }, "Could not increment user AI quota");
    }
  }

  return {
    ...result,
    ai_usage_count: currentUsage,
    ai_quota_limit: quotaLimit,
    plan_tier: userPlanTier,
  };
}

