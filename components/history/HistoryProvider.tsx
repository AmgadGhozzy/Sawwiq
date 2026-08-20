"use client";

import { useState } from "react";
import HistoryTrigger from "./HistoryTrigger";
import HistoryDrawer from "./HistoryDrawer";

// ---------------------------------------------------------------------------
// HistoryProvider — ties HistoryTrigger and HistoryDrawer together
// with shared open/close state. Placed in page.tsx.
// ---------------------------------------------------------------------------

export default function HistoryProvider() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HistoryTrigger onClick={() => setOpen(true)} />
      <HistoryDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
