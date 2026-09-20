import "global-jsdom/register";
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import ContentGenerator from "../components/generator/ContentGenerator";
import { HistoryContextProvider } from "../components/history/HistoryContext";
import { NextIntlClientProvider } from "next-intl";
import { ERROR_CODES } from "../types/content";
import fs from "fs";
import path from "path";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: any) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function() {};

const arMessages = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "messages", "ar.json"), "utf8")
);

const originalFetch = global.fetch;

describe("Phase 6.2 - Layer B: UI Behavior", () => {
  let fetchMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    fetchMock = mock.fn();
    global.fetch = fetchMock as any;
    
    // Default history fetch
    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 500 });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restoreAll();
    cleanup();
  });

  function renderComponent() {
    return render(
      React.createElement(
        NextIntlClientProvider,
        { locale: "ar", messages: arMessages, onError: () => {} },
        React.createElement(
          HistoryContextProvider,
          null,
          React.createElement(ContentGenerator, null)
        )
      )
    );
  }

  async function submitForm() {
    const rawInput = document.querySelector("textarea");
    if (rawInput) {
      fireEvent.change(rawInput, { target: { value: "Test Input" } });
    }

    // There are 2 forms potentially (mobile/desktop). By default desktop is shown.
    const forms = document.querySelectorAll("form");
    fireEvent.submit(forms[forms.length - 1]);
  }

  test("1. Network rejection -> UI error state", async () => {
    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/generate")) {
        throw new Error("Network Error");
      }
      return new Response();
    });

    renderComponent();
    await submitForm();

    const expectedErrorMsg = arMessages.Errors.INTERNAL_ERROR;
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      assert.strictEqual(alert.textContent, expectedErrorMsg);
    });
  });

  test("2. Canonical generation error -> error state + translated GENERATION_FAILED", async () => {
    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/generate")) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: ERROR_CODES.GENERATION_FAILED }
        }), { status: 200 });
      }
      return new Response();
    });

    renderComponent();
    await submitForm();

    const expectedErrorMsg = arMessages.Errors.GENERATION_FAILED;
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      assert.strictEqual(alert.textContent, expectedErrorMsg);
    });
  });

  test("3. Rate limit -> locked state", async () => {
    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/generate")) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: ERROR_CODES.RATE_LIMIT_REACHED }
        }), { status: 200 });
      }
      return new Response();
    });

    renderComponent();
    await submitForm();

    const expectedLockedBtn = arMessages.ContentGenerator.lockedButton;
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      const lockedBtn = buttons.find(b => b.textContent?.includes(expectedLockedBtn));
      assert.ok(lockedBtn, "Should show locked button state");
    });
  });

  test("4. Successful response -> UI state maps fields correctly", async () => {
    const mockGeneratedContent = {
      title: "Mapped Title",
      hook: "Mapped Hook",
      body: "Mapped Body",
      callToAction: "Mapped CTA",
      hashtags: ["#Mapped1", "#Mapped2"]
    };

    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/generate")) {
        return new Response(JSON.stringify({
          success: true,
          data: mockGeneratedContent
        }), { status: 200 });
      }
      return new Response();
    });

    renderComponent();
    await submitForm();

    await waitFor(() => {
      // The GenerationResult component will render the text fields
      expectTextExists("Mapped Title");
      expectTextExists("Mapped Hook");
      expectTextExists("Mapped Body");
      expectTextExists("Mapped CTA");
      expectTextExists("#Mapped1");
    });
    
    function expectTextExists(text: string) {
      const elements = screen.getAllByText(new RegExp(text, "i"));
      assert.ok(elements.length > 0, `Could not find text: ${text}`);
    }
  });

  test("5. Internal error leakage protection", async () => {
    fetchMock.mock.mockImplementation(async (url: string | Request) => {
      if (typeof url === "string" && url.includes("/api/history")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (typeof url === "string" && url.includes("/api/generate")) {
        return new Response(JSON.stringify({
          success: false,
          error: { 
            code: ERROR_CODES.GENERATION_FAILED,
            message: "PLANNER_TOPOLOGY_VIOLATION_LEAK" 
          }
        }), { status: 200 });
      }
      return new Response();
    });

    renderComponent();
    await submitForm();

    const expectedErrorMsg = arMessages.Errors.GENERATION_FAILED;
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      assert.strictEqual(alert.textContent, expectedErrorMsg);
      // Ensure the leak is NOT present
      assert.strictEqual(alert.textContent.includes("PLANNER_TOPOLOGY"), false);
    });
  });
});
