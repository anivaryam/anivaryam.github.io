import { afterEach, describe, expect, it } from "vitest";
import {
  forgetProviderSettings,
  hasSavedProviderSettings,
  saveProviderSettings,
  unlockProviderSettings,
} from "./storage";

const settings = {
  apiBase: "https://api.example.com/v1",
  apiKey: "secret-test-api-key",
  selectedModel: "model-test",
};

afterEach(() => {
  localStorage.clear();
});

describe("encrypted provider settings", () => {
  it("stores only encrypted data and restores the key and selected model with the passphrase", async () => {
    await saveProviderSettings(settings, "a-long-test-passphrase");

    const stored = localStorage.getItem("related-product-finder.v1");
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(settings.apiKey);
    expect(stored).not.toContain(settings.selectedModel);
    expect(await unlockProviderSettings("a-long-test-passphrase")).toEqual(settings);
  });

  it("rejects a wrong passphrase without changing the saved ciphertext", async () => {
    await saveProviderSettings(settings, "a-long-test-passphrase");
    const before = localStorage.getItem("related-product-finder.v1");

    await expect(unlockProviderSettings("wrong-passphrase")).rejects.toThrow("Could not unlock");
    expect(localStorage.getItem("related-product-finder.v1")).toBe(before);
  });

  it("requires a long passphrase and supports explicit forgetting", async () => {
    await expect(saveProviderSettings(settings, "short")).rejects.toThrow("at least 12 characters");
    await saveProviderSettings(settings, "a-long-test-passphrase");
    expect(hasSavedProviderSettings()).toBe(true);

    forgetProviderSettings();
    expect(hasSavedProviderSettings()).toBe(false);
  });
});
