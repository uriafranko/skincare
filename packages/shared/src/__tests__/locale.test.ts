import { describe, expect, test } from "bun:test";
import { detectRegion, getLocaleName, getTimezoneCity } from "../locale";

describe("detectRegion", () => {
  test("US phone number", () => {
    const result = detectRegion("+14155551234");
    expect(result.locale).toBe("en");
    expect(result.country).toBe("US");
    expect(result.countryName).toContain("United States");
    expect(result.timezone).toBe("UTC");
  });

  test("Swedish phone number", () => {
    const result = detectRegion("+46701234567");
    expect(result.locale).toBe("sv");
    expect(result.country).toBe("SE");
    expect(result.timezone).toBeDefined();
  });

  test("Japanese phone number", () => {
    const result = detectRegion("+81312345678");
    expect(result.locale).toBe("ja");
    expect(result.country).toBe("JP");
    expect(result.timezone).toBe("Asia/Tokyo");
  });

  test("Israeli phone number", () => {
    const result = detectRegion("+972501234567");
    expect(result.locale).toBe("he");
    expect(result.country).toBe("IL");
    expect(result.timezone).toBeDefined();
  });

  test("invalid phone falls back to US/English", () => {
    const result = detectRegion("not-a-phone");
    expect(result.locale).toBe("en");
    expect(result.country).toBe("US");
  });

  test.each([
    ["Canada", "+14165550123", "CA"],
    ["Australia", "+61412345678", "AU"],
    ["Brazil", "+5511987654321", "BR"],
    ["Indonesia", "+628123456789", "ID"],
  ])("uses UTC for multi-zone country %s", (_name, phone, country) => {
    const result = detectRegion(phone);

    expect(result.country).toBe(country);
    expect(result.timezone).toBe("UTC");
  });
});

describe("getLocaleName", () => {
  test("known locales", () => {
    expect(getLocaleName("en")).toBe("English");
    expect(getLocaleName("sv")).toBe("Swedish");
    expect(getLocaleName("ja")).toBe("Japanese");
    expect(getLocaleName("he")).toBe("Hebrew");
  });

  test("unknown locale falls back to English", () => {
    expect(getLocaleName("xx")).toBe("English");
  });
});

describe("getTimezoneCity", () => {
  test("extracts city from IANA timezone", () => {
    expect(getTimezoneCity("Europe/Stockholm")).toBe("Stockholm");
    expect(getTimezoneCity("America/New_York")).toBe("New York");
  });

  test("handles single segment", () => {
    expect(getTimezoneCity("UTC")).toBe("UTC");
  });
});
