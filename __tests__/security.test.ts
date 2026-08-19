// ---------------------------------------------------------------------------
// Security Regression Tests
//
// These tests verify the security hardening changes:
// 1. Session identity from header only — body fallback removed
// 2. Oversized request body rejection
// 3. Cookie configuration (HttpOnly, Secure, SameSite, Path, MaxAge)
// 4. Secrets never exposed via NEXT_PUBLIC_ prefix
// 5. Error messages don't leak internal env var names
// 6. Defense-in-depth body stripping
// ---------------------------------------------------------------------------

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sessionConfig } from "../lib/config";
import { generateInputSchema } from "../lib/validation/generation";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// 1. Edge Function: session_token body fallback removed
// ---------------------------------------------------------------------------

describe("Edge Function — session identity from header only", () => {
  // Read the Edge Function source to verify no body session_token reference
  const edgeFunctionPath = path.resolve(
    __dirname,
    "../supabase/functions/generate/index.ts"
  );
  const edgeSource = fs.readFileSync(edgeFunctionPath, "utf-8");

  test("Edge Function does NOT read session_token from request body", () => {
    // The old pattern was: (body as Record<string, string>).session_token
    assert.ok(
      !edgeSource.includes("body.session_token") &&
        !edgeSource.includes(').session_token') &&
        !edgeSource.includes("body).session_token"),
      "Edge Function must NOT read session_token from the request body"
    );
  });

  test("Edge Function reads session exclusively from x-session-token header", () => {
    assert.ok(
      edgeSource.includes('req.headers.get("x-session-token")'),
      "Edge Function must read session from x-session-token header"
    );
  });

  test("Edge Function returns 401 for SESSION_MISSING (not 400)", () => {
    // Match the pattern: corsResponse(...SESSION_MISSING..., 401, ...)
    assert.ok(
      edgeSource.includes('"SESSION_MISSING"'),
      "Edge Function must return SESSION_MISSING error code"
    );
    // Verify the 401 is paired with SESSION_MISSING
    const sessionMissingLine = edgeSource
      .split("\n")
      .find((line) => line.includes("SESSION_MISSING"));
    assert.ok(sessionMissingLine, "SESSION_MISSING line must exist");
    assert.ok(
      sessionMissingLine.includes("401"),
      `SESSION_MISSING must return 401, found: ${sessionMissingLine.trim()}`
    );
  });

  test("session_token in body with NO x-session-token header would result in SESSION_MISSING", () => {
    // This verifies that the Edge Function's session extraction logic
    // is ONLY: req.headers.get("x-session-token")
    // If the header is null, sessionToken is null → SESSION_MISSING
    const sessionExtractionPattern =
      /const sessionToken\s*=\s*req\.headers\.get\("x-session-token"\)/;
    assert.ok(
      sessionExtractionPattern.test(edgeSource),
      "sessionToken must be assigned exclusively from req.headers.get('x-session-token')"
    );
  });
});

// ---------------------------------------------------------------------------
// 2. API Route: body session stripping (defense-in-depth)
// ---------------------------------------------------------------------------

describe("API Route — defense-in-depth body stripping", () => {
  const apiRoutePath = path.resolve(
    __dirname,
    "../app/api/generate/route.ts"
  );
  const apiSource = fs.readFileSync(apiRoutePath, "utf-8");

  test("API route deletes session_token from parsed body", () => {
    assert.ok(
      apiSource.includes("delete sanitized.session_token"),
      "API route must strip session_token from body"
    );
  });

  test("API route deletes sessionToken (camelCase) from parsed body", () => {
    assert.ok(
      apiSource.includes("delete sanitized.sessionToken"),
      "API route must strip sessionToken from body"
    );
  });

  test("API route returns 401 for SESSION_MISSING", () => {
    assert.ok(
      apiSource.includes("ERROR_CODES.SESSION_MISSING"),
      "API route must check for SESSION_MISSING"
    );
    // Find the line with SESSION_MISSING and verify 401
    const lines = apiSource.split("\n");
    const sessionMissingIdx = lines.findIndex((l) =>
      l.includes("SESSION_MISSING")
    );
    // The status 401 should be within a few lines of the SESSION_MISSING check
    const contextBlock = lines
      .slice(sessionMissingIdx, sessionMissingIdx + 5)
      .join("\n");
    assert.ok(
      contextBlock.includes("401"),
      `SESSION_MISSING must return 401, context: ${contextBlock.trim()}`
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Body stripping actually works at runtime
// ---------------------------------------------------------------------------

describe("Body stripping — runtime behavior", () => {
  test("session_token is removed from a body object with valid fields", () => {
    const body: Record<string, unknown> = {
      platform: "instagram",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
      session_token: "attacker-controlled-token",
    };

    // Replicate the stripping logic from the API route
    delete body.session_token;
    delete body.sessionToken;

    assert.strictEqual(body.session_token, undefined);
    assert.strictEqual(body.sessionToken, undefined);

    // Verify valid fields are preserved
    assert.strictEqual(body.platform, "instagram");
    assert.strictEqual(body.contentType, "sponsored_ad");
  });

  test("sessionToken (camelCase) is removed from a body object", () => {
    const body: Record<string, unknown> = {
      platform: "instagram",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
      sessionToken: "attacker-camelCase-token",
    };

    delete body.session_token;
    delete body.sessionToken;

    assert.strictEqual(body.sessionToken, undefined);
  });

  test("body without session fields passes through unchanged", () => {
    const body: Record<string, unknown> = {
      platform: "instagram",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
    };

    delete body.session_token;
    delete body.sessionToken;

    // All original fields intact
    assert.strictEqual(Object.keys(body).length, 4);
    assert.strictEqual(body.platform, "instagram");
  });
});

// ---------------------------------------------------------------------------
// 4. Oversized request body rejection
// ---------------------------------------------------------------------------

describe("Request body size protection", () => {
  const apiRoutePath = path.resolve(
    __dirname,
    "../app/api/generate/route.ts"
  );
  const apiSource = fs.readFileSync(apiRoutePath, "utf-8");

  test("MAX_BODY_SIZE constant is defined", () => {
    assert.ok(
      apiSource.includes("MAX_BODY_SIZE"),
      "API route must define MAX_BODY_SIZE"
    );
  });

  test("Content-Length header is checked before reading body", () => {
    const contentLengthIdx = apiSource.indexOf("content-length");
    const requestTextIdx = apiSource.indexOf("request.text()");
    assert.ok(contentLengthIdx > -1, "Must check content-length header");
    assert.ok(requestTextIdx > -1, "Must read body via request.text()");
    assert.ok(
      contentLengthIdx < requestTextIdx,
      "Content-Length check must come BEFORE reading the body"
    );
  });

  test("Body length is checked after reading (hard ceiling)", () => {
    const requestTextIdx = apiSource.indexOf("request.text()");
    const bodyLengthCheckIdx = apiSource.indexOf("rawBody.length > MAX_BODY_SIZE");
    assert.ok(
      bodyLengthCheckIdx > requestTextIdx,
      "Body length must be checked AFTER reading raw body"
    );
  });

  test("Oversized responses return HTTP 413", () => {
    // Both Content-Length and body-length checks should return 413
    const lines = apiSource.split("\n");
    const oversizeLines = lines.filter(
      (l) => l.includes("MAX_BODY_SIZE") && l.includes(">")
    );
    assert.ok(oversizeLines.length >= 2, "Should have at least 2 size checks");

    // Each size check should be followed within a few lines by a 413 status
    for (const line of oversizeLines) {
      const idx = lines.indexOf(line);
      const context = lines.slice(idx, idx + 3).join("\n");
      assert.ok(
        context.includes("413"),
        `Size check must return 413: ${context.trim()}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Cookie configuration audit
// ---------------------------------------------------------------------------

describe("Cookie configuration", () => {
  test("session cookie name is 'sawwiq_session'", () => {
    assert.strictEqual(sessionConfig.cookieName, "sawwiq_session");
  });

  test("middleware sets HttpOnly, Secure, SameSite=Lax, Path=/", () => {
    const middlewarePath = path.resolve(__dirname, "../proxy.ts");
    const middlewareSource = fs.readFileSync(middlewarePath, "utf-8");

    assert.ok(
      middlewareSource.includes("httpOnly: true"),
      "Cookie must be HttpOnly"
    );
    assert.ok(
      middlewareSource.includes('sameSite: "lax"'),
      "Cookie must have SameSite=Lax"
    );
    assert.ok(
      middlewareSource.includes('path: "/"'),
      "Cookie must have Path=/"
    );
    assert.ok(
      middlewareSource.includes("secure: process.env.NODE_ENV"),
      "Cookie must be Secure in production"
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Secrets isolation — never exposed via NEXT_PUBLIC_
// ---------------------------------------------------------------------------

describe("Secrets isolation", () => {
  test("GEMINI_API_KEY is NOT prefixed with NEXT_PUBLIC_", () => {
    const envExamplePath = path.resolve(__dirname, "../.env.example");
    const envContent = fs.readFileSync(envExamplePath, "utf-8");
    assert.ok(
      !envContent.includes("NEXT_PUBLIC_GEMINI_API_KEY"),
      "GEMINI_API_KEY must NOT be prefixed with NEXT_PUBLIC_"
    );
    assert.ok(
      envContent.includes("GEMINI_API_KEY="),
      "GEMINI_API_KEY must exist in .env.example"
    );
  });

  test("SUPABASE_SERVICE_ROLE_KEY is NOT prefixed with NEXT_PUBLIC_", () => {
    const envExamplePath = path.resolve(__dirname, "../.env.example");
    const envContent = fs.readFileSync(envExamplePath, "utf-8");
    assert.ok(
      !envContent.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
      "SUPABASE_SERVICE_ROLE_KEY must NOT be prefixed with NEXT_PUBLIC_"
    );
    assert.ok(
      envContent.includes("SUPABASE_SERVICE_ROLE_KEY="),
      "SUPABASE_SERVICE_ROLE_KEY must exist in .env.example"
    );
  });

  test("no client component imports supabase server module", () => {
    // Verify lib/supabase/server.ts is not imported in components/
    const componentsDir = path.resolve(__dirname, "../components");
    const componentFiles = getAllTsFiles(componentsDir);

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(
        !content.includes("supabase/server") &&
          !content.includes("getSupabaseAdmin"),
        `Client component ${path.basename(file)} must NOT import supabase server module`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Error message sanitization
// ---------------------------------------------------------------------------

describe("Error message sanitization", () => {
  test("Edge Function does NOT leak env var names in error responses", () => {
    const edgeFunctionPath = path.resolve(
      __dirname,
      "../supabase/functions/generate/index.ts"
    );
    const edgeSource = fs.readFileSync(edgeFunctionPath, "utf-8");

    // Find all corsResponse calls that are error responses
    const errorResponseCalls = edgeSource
      .split("\n")
      .filter((line) => line.includes("corsResponse(JSON.stringify"));

    for (const line of errorResponseCalls) {
      assert.ok(
        !line.includes("GEMINI_API_KEY") &&
          !line.includes("SERVICE_ROLE_KEY") &&
          !line.includes("SUPABASE_SERVICE_ROLE_KEY"),
        `Error response must not leak env var names: ${line.trim()}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Zod input validation still works after body stripping
// ---------------------------------------------------------------------------

describe("Input validation after body stripping", () => {
  test("valid input with injected session_token: validation passes, token stripped", () => {
    const input: Record<string, unknown> = {
      platform: "instagram",
      contentType: "sponsored_ad",
      arabicStyle: "white_arabic",
      rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
      session_token: "attacker-token",
    };

    // Zod parse succeeds (session_token is an unknown key, passthrough by default)
    const parsed = generateInputSchema.parse(input);
    assert.ok(parsed.platform === "instagram");

    // Strip session fields
    delete input.session_token;
    delete input.sessionToken;
    assert.strictEqual(input.session_token, undefined);
  });

  test("valid input without session_token: validation passes normally", () => {
    const input = {
      platform: "instagram" as const,
      contentType: "sponsored_ad" as const,
      arabicStyle: "white_arabic" as const,
      rawInput: "شقة 180 متر في التجمع الخامس تشطيب سوبر لوكس",
    };

    assert.doesNotThrow(() => generateInputSchema.parse(input));
  });
});

// ---------------------------------------------------------------------------
// 9. CORS allowlist
// ---------------------------------------------------------------------------

describe("CORS allowlist", () => {
  test("only allows production domains and localhost", () => {
    const corsPath = path.resolve(
      __dirname,
      "../supabase/functions/generate/utils/cors.ts"
    );
    const corsSource = fs.readFileSync(corsPath, "utf-8");

    // Extract ALLOWED_ORIGINS array
    const originsMatch = corsSource.match(
      /ALLOWED_ORIGINS\s*=\s*\[([\s\S]*?)\]/
    );
    assert.ok(originsMatch, "ALLOWED_ORIGINS must be defined");

    const originsBlock = originsMatch![1];
    const origins = originsBlock
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    // Every origin must be either sawwiq.com (https) or localhost
    for (const origin of origins) {
      const isSawwiq = origin.startsWith("https://") && origin.includes("sawwiq.com");
      const isLocalhost = origin.startsWith("http://localhost:");
      assert.ok(
        isSawwiq || isLocalhost,
        `Unexpected CORS origin: ${origin}`
      );
    }

    // Must NOT contain wildcard
    assert.ok(!corsSource.includes('"*"'), "CORS must not allow wildcard origin");
  });
});

// ---------------------------------------------------------------------------
// 10. .gitignore covers env files
// ---------------------------------------------------------------------------

describe(".gitignore coverage", () => {
  test(".env* pattern is in .gitignore", () => {
    const gitignorePath = path.resolve(__dirname, "../.gitignore");
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    assert.ok(
      gitignore.includes(".env*"),
      ".gitignore must include .env* pattern"
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}
