"use client";

import { useHistoryContext } from "./HistoryContext";
import HistoryTrigger from "./HistoryTrigger";
import HistoryDrawer from "./HistoryDrawer";

// ---------------------------------------------------------------------------
// HistoryProvider - ties HistoryTrigger and HistoryDrawer together
// with shared open/close state from Context. Placed in page.tsx.
// ---------------------------------------------------------------------------

export default function HistoryProvider() {
  const { isDrawerOpen, setIsDrawerOpen } = useHistoryContext();

  return (
    <>
      <HistoryTrigger onClick={() => setIsDrawerOpen(true)} />
      <HistoryDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
