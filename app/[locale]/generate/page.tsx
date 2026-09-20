import ContentGenerator from "@/components/generator/ContentGenerator";

/**
 * /[locale]/generate — the dedicated AI workspace.
 *
 * Layout: Edge-to-edge Workspace.
 * flex, h-full, min-h-0.
 */
export default function GeneratePage() {
  return (
    <main className="flex flex-1 flex-col min-h-0 h-full bg-background overflow-y-auto md:overflow-hidden relative">
      <ContentGenerator />
    </main>
  );
}
