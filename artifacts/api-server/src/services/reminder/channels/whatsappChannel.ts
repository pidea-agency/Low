import { getSettings } from "../../../config/settings-store";
import { logger } from "../../../lib/logger";
import type { ReminderChannel, ReminderPayload } from "../reminder.types";

export function formatWhatsappMessage(payload: ReminderPayload): string {
  const timeDesc = payload.remainingText
    ? payload.remainingText
    : payload.kind === "24h"
    ? "متبقي 24 ساعة"
    : payload.kind === "6h"
    ? "متبقي 6 ساعات"
    : "تذكير فوري";

  const lines: string[] = [
    `🔔 *تذكير بموعد جلسة قضائية* (${timeDesc})`,
    "",
    `📋 *رقم القضية:* ${payload.caseNumber || "غير محدد"}`,
  ];

  if (payload.court) lines.push(`⚖️ *المحكمة:* ${payload.court}`);
  if (payload.courtCircuit) lines.push(`🏛️ *الدائرة:* ${payload.courtCircuit}`);
  if (payload.sessionDateHijri) lines.push(`📅 *التاريخ الهجري:* ${payload.sessionDateHijri}`);
  if (payload.sessionTime) lines.push(`⏰ *وقت الجلسة:* ${payload.sessionTime}`);
  if (payload.plaintiff) lines.push(`👤 *المدعي:* ${payload.plaintiff}`);
  if (payload.defendant) lines.push(`👥 *المدعى عليه:* ${payload.defendant}`);
  if (payload.caseSubject) lines.push(`📝 *موضوع القضية:* ${payload.caseSubject}`);

  lines.push("", "الرجاء التحضير والاستعداد للجلسة في الموعد المحدد.");
  return lines.join("\n");
}

function buildWhatsappPayloadAndHeaders(
  url: string,
  phone: string,
  token: string | undefined,
  message: string,
  instanceId?: string,
): { targetUrl: string; method: string; headers: Record<string, string>; body?: string; isGreenApi?: boolean } {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const formattedChatId = `${cleanPhone}@c.us`;

  // 1. CallMeBot
  if (url.includes("callmebot.com")) {
    const params = new URLSearchParams({
      phone: phone,
      text: message,
      apikey: token || "",
    });
    return {
      targetUrl: `${url.split("?")[0]}?${params.toString()}`,
      method: "GET",
      headers: {},
    };
  }

  // 2. Green API — auto-build endpoint if instanceId is provided
  if (url.includes("green-api.com") || url.includes("greenapi")) {
    // If the URL already contains /waInstance and /sendMessage, use it as-is
    if (url.includes("/waInstance") && url.includes("/sendMessage")) {
      return {
        targetUrl: url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: formattedChatId, message }),
      };
    }

    // Auto-build: base URL + instance ID + token
    if (instanceId && token) {
      const base = url.replace(/\/+$/, ""); // strip trailing slash
      const endpoint = `${base}/waInstance${instanceId}/sendMessage/${token}`;
      return {
        targetUrl: endpoint,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: formattedChatId, message }),
        isGreenApi: true,
      };
    }

    // Missing instance ID — throw descriptive error
    throw new Error(
      "إعداد Green API غير مكتمل: يرجى إدخال Instance ID في حقل «Instance ID» بإعدادات الواتساب.",
    );
  }

  // 3. UltraMsg
  if (url.includes("ultramsg.com")) {
    return {
      targetUrl: url,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: token || "",
        to: phone,
        body: message,
      }).toString(),
    };
  }

  // 4. Meta WhatsApp Cloud API
  if (url.includes("graph.facebook.com")) {
    return {
      targetUrl: url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    };
  }

  // 5. Generic Webhook / Default Gateway
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-api-key"] = token;
  }

  return {
    targetUrl: url,
    method: "POST",
    headers,
    body: JSON.stringify({
      phone: phone,
      to: phone,
      number: cleanPhone,
      chatId: formattedChatId,
      message: message,
      body: message,
      text: message,
      token: token,
      apikey: token,
    }),
  };
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 3) return "***";
  return "*".repeat(cleaned.length - 3) + cleaned.slice(-3);
}

export class WhatsappReminderChannel implements ReminderChannel {
  readonly name = "whatsapp";

  async sendRaw(message: string, recipientPhone?: string): Promise<void> {
    const phone = recipientPhone?.trim();

    if (!phone) {
      throw new Error("Recipient phone number is required to send WhatsApp reminder.");
    }

    const masked = maskPhone(phone);
    const settings = getSettings();

    if (settings.whatsappApiUrl) {
      const requestConfig = buildWhatsappPayloadAndHeaders(
        settings.whatsappApiUrl.trim(),
        phone,
        settings.whatsappToken?.trim(),
        message,
        settings.whatsappInstanceId?.trim(),
      );

      try {
        const res = await fetch(requestConfig.targetUrl, {
          method: requestConfig.method,
          headers: requestConfig.headers,
          body: requestConfig.body,
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          logger.error(
            { status: res.status, bodyText, phone: masked },
            "WhatsApp Gateway API returned non-OK status",
          );
          throw new Error(
            `بوابة الواتساب أرجعت خطأ (${res.status}): ${bodyText.slice(0, 120) || res.statusText}`,
          );
        } else {
          // Green API may return HTTP 200 but with an error body (e.g. notAuthorized)
          if (requestConfig.isGreenApi) {
            const bodyText = await res.text().catch(() => "{}");
            let parsed: Record<string, unknown> = {};
            try { parsed = JSON.parse(bodyText) as Record<string, unknown>; } catch { /* ignore */ }

            if (parsed["instanceError"] || parsed["typeError"]) {
              const errMsg = (parsed["errorMessage"] ?? parsed["instanceError"] ?? parsed["typeError"]) as string;
              logger.error({ errMsg, phone: masked }, "Green API error in response body");
              if (String(errMsg).includes("notAuthorized")) {
                throw new Error(
                  "⚠️ الـ Instance غير متصل بالواتساب — افتح console.greenapi.com واسحب QR Code بهاتفك.",
                );
              }
              throw new Error(`Green API أرجع خطأ: ${errMsg}`);
            }

            if (!parsed["idMessage"]) {
              logger.warn({ bodyText, phone: masked }, "Green API response has no idMessage — message may not have been sent");
            }
          }

          logger.info(
            { phone: masked },
            "WhatsApp reminder sent via Gateway API successfully",
          );
        }
      } catch (err) {
        logger.error({ err, phone: masked }, "Failed to call WhatsApp Gateway API");
        throw err;
      }
    } else {
      logger.info(
        {
          phone: masked,
        },
        "[WhatsApp Reminder Triggered] Notification formatted for target recipient",
      );
    }
  }

  async send(payload: ReminderPayload): Promise<void> {
    const phone = payload.recipientPhone?.trim();
    if (!phone) {
      throw new Error("Recipient phone number is required to send WhatsApp reminder.");
    }
    const message = formatWhatsappMessage(payload);
    return this.sendRaw(message, phone);
  }
}
