import { describe, it, expect } from "vitest";
import {
  APP_NAVIGATION_CONFIG,
  getNavItemsForRole,
  isRouteAllowedForRole,
  evaluateRoleGuardState,
} from "@workspace/api-zod";

describe("Frontend Settings Access & Navigation Role Guarding", () => {
  it("sidebar/navigation does not show the settings link for a lawyer (staff)", () => {
    const lawyerNav = getNavItemsForRole("staff");
    const settingsItem = lawyerNav.find((item) => item.path === "/settings");
    expect(settingsItem).toBeUndefined();

    // Admin portal should also not be in lawyer nav
    const adminPortal = lawyerNav.find((item) => item.path === "/admin");
    expect(adminPortal).toBeUndefined();
  });

  it("sidebar/navigation shows the settings link for an admin", () => {
    const adminNav = getNavItemsForRole("admin");
    const settingsItem = adminNav.find((item) => item.path === "/settings");
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.name).toMatch(/إعدادات/);
  });

  it("quick search does not list the settings page for a lawyer, but lists it for an admin", () => {
    // Lawyer search items
    const lawyerItems = getNavItemsForRole("staff");
    const lawyerHasSettings = lawyerItems.some(
      (item) => item.keywords.includes("الإعدادات") || item.path === "/settings"
    );
    expect(lawyerHasSettings).toBe(false);

    // Admin search items
    const adminItems = getNavItemsForRole("admin");
    const adminSettings = adminItems.find(
      (item) => item.keywords.includes("الإعدادات") && item.path === "/settings"
    );
    expect(adminSettings).toBeDefined();
  });

  it("while role is still loading, guard resolves to LOADING (never renders settings content)", () => {
    const state = evaluateRoleGuardState({
      user: null,
      isLoading: true,
      isError: false,
      requiredRoles: ["admin"],
    });

    expect(state).toBe("LOADING");
    expect(state).not.toBe("ALLOWED");
  });

  it("lawyer navigating to /settings resolves to FORBIDDEN with clear message", () => {
    const lawyerUser = { username: "12345", role: "staff" };
    const state = evaluateRoleGuardState({
      user: lawyerUser,
      isLoading: false,
      isError: false,
      requiredRoles: ["admin"],
    });

    expect(state).toBe("FORBIDDEN");
    expect(state).not.toBe("ALLOWED");
    expect(isRouteAllowedForRole("/settings", "staff")).toBe(false);
  });

  it("admin navigating to /settings resolves to ALLOWED", () => {
    const adminUser = { username: "123456", role: "admin" };
    const state = evaluateRoleGuardState({
      user: adminUser,
      isLoading: false,
      isError: false,
      requiredRoles: ["admin"],
    });

    expect(state).toBe("ALLOWED");
    expect(isRouteAllowedForRole("/settings", "admin")).toBe(true);
  });
});
