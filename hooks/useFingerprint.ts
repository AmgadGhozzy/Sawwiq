"use client";

import { useState, useEffect } from "react";

/**
 * Generates a browser fingerprint using FingerprintJS (open-source).
 *
 * The fingerprint is a best-effort risk signal — NOT authentication.
 * It may change across browser updates, extensions, or privacy settings.
 * The raw visitorId is sent to the server which HMAC-hashes it before storage.
 *
 * Returns null if fingerprinting fails or hasn't loaded yet.
 */
export function useFingerprint(): string | null {
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const fp = await FingerprintJS.load();
        const result = await fp.get();

        if (!cancelled) {
          setVisitorId(result.visitorId);
        }
      } catch {
        // Fingerprint is optional — fail silently
        // Anti-abuse still works via IP + bonus cap
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return visitorId;
}
