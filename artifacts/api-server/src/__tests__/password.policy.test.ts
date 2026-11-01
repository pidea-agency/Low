import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as supabaseService from "../services/supabase.service";
import { validatePassword, PASSWORD_POLICY } from "@workspace/api-zod";

describe("Unified Password Policy & Enforcement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Unit tests: validatePassword function", () => {
    it("rejects 4, 5, 6, 7 character passwords", () => {
      expect(validatePassword("A1b").isValid).toBe(false);
      expect(validatePassword("A1b2").isValid).toBe(false);
      expect(validatePassword("A1b2C").isValid).toBe(false);
      expect(validatePassword("A1b2Cd").isValid).toBe(false);
      expect(validatePassword("A1b2Cd3").isValid).toBe(false);

      const res = validatePassword("A1b2Cd3");
      expect(res.reason).toBe("TOO_SHORT");
      expect(res.message).toContain("8 خانات");
    });

    it("rejects letters-only and digits-only passwords", () => {
      // Letters only (Latin)
      const lettersOnly = validatePassword("abcdefgh");
      expect(lettersOnly.isValid).toBe(false);
      expect(lettersOnly.reason).toBe("MISSING_DIGIT");
      expect(lettersOnly.message).toContain("رقم واحد");

      // Letters only (Arabic)
      const arabicLettersOnly = validatePassword("كلمةسرعربية");
      expect(arabicLettersOnly.isValid).toBe(false);
      expect(arabicLettersOnly.reason).toBe("MISSING_DIGIT");

      // Digits only
      const digitsOnly = validatePassword("987654321");
      expect(digitsOnly.isValid).toBe(false);
      expect(digitsOnly.reason).toBe("MISSING_LETTER");
      expect(digitsOnly.message).toContain("حرف واحد");
    });

    it("rejects a commonly used password", () => {
      const res = validatePassword("password123");
      expect(res.isValid).toBe(false);
      expect(res.reason).toBe("COMMONLY_USED");
      expect(res.message).toContain("شائعة");
    });

    it("rejects a password equal to the username or email", () => {
      const resUser = validatePassword("lawyer2026", { username: "lawyer2026" });
      expect(resUser.isValid).toBe(false);
      expect(resUser.reason).toBe("EQUALS_USERNAME");
      expect(resUser.message).toContain("مطابقة لاسم المستخدم");

      const resEmail = validatePassword("lawyer2026", { email: "lawyer2026@test.com" });
      expect(resEmail.isValid).toBe(false);
      expect(resEmail.reason).toBe("EQUALS_EMAIL");
      expect(resEmail.message).toContain("مطابقة للبريد الإلكتروني");
    });

    it("accepts a valid password meeting all criteria (with Latin or Arabic letters)", () => {
      const validLatin = validatePassword("SecurePass2026!");
      expect(validLatin.isValid).toBe(true);

      const validArabic = validatePassword("محاماة2026خاصة");
      expect(validArabic.isValid).toBe(true);
    });
  });

  describe("Server Integration & Direct Route Enforcement", () => {
    it("rejects 4, 5, 6, 7 character passwords in createSupabaseUser service", async () => {
      await expect(
        supabaseService.createSupabaseUser({
          username: `test_short_${Date.now()}`,
          password: "Short1",
        }),
      ).rejects.toThrow(/8 خانات/);
    });

    it("rejects letters-only passwords in createSupabaseUser service", async () => {
      await expect(
        supabaseService.createSupabaseUser({
          username: `test_letters_${Date.now()}`,
          password: "onlyletterslong",
        }),
      ).rejects.toThrow(/رقم واحد/);
    });

    it("rejects common passwords in createSupabaseUser service", async () => {
      await expect(
        supabaseService.createSupabaseUser({
          username: `test_common_${Date.now()}`,
          password: "password123",
        }),
      ).rejects.toThrow(/شائعة/);
    });

    it("rejects a direct POST /api/users request with a weak password (bypassing UI) with 400 and Arabic message", async () => {
      // Mock an admin user session
      vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
        id: "admin-id-1",
        username: "admin_user",
        role: "admin",
        status: "active",
      } as any);

      const adminCookie = createSignedSessionCookie({
        userId: "admin-id-1",
        username: "admin_user",
      });

      // Attempt 1: 5-character password
      const resShort = await request(app)
        .post("/api/users")
        .set("Cookie", adminCookie)
        .send({
          username: `user_${Date.now()}_short`,
          password: "12345",
          role: "staff",
        });

      expect(resShort.status).toBe(400);
      expect(resShort.body.error).toContain("8 خانات");

      // Attempt 2: Letters only
      const resLetters = await request(app)
        .post("/api/users")
        .set("Cookie", adminCookie)
        .send({
          username: `user_${Date.now()}_letters`,
          password: "lettersalltheway",
          role: "staff",
        });

      expect(resLetters.status).toBe(400);
      expect(resLetters.body.error).toContain("رقم واحد");
    });

    it("enforces the same rules on PATCH /api/users/:id (change-password path)", async () => {
      vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
        id: "admin-id-1",
        username: "admin_user",
        role: "admin",
        status: "active",
      } as any);

      const adminCookie = createSignedSessionCookie({
        userId: "admin-id-1",
        username: "admin_user",
      });

      // Attempt weak password on patch
      const res = await request(app)
        .patch("/api/users/some-user-id")
        .set("Cookie", adminCookie)
        .send({
          password: "weak",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("8 خانات");
    });
  });
});

