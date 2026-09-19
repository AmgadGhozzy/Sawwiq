import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Lift above background layers (generator workspace). */
  elevated?: boolean;
}

export default function Section({
  id,
  children,
  className = "",
  elevated = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative ${elevated ? "z-20" : "z-10"} px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mt-20 mb-20 scroll-mt-24 ${className}`}
    >
      {children}
    </section>
  );
}
