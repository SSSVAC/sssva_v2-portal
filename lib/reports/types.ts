import type { ComponentType } from "react";
import type { createClient } from "@/lib/supabase/server";

export type ReportCategory = "financial" | "silai" | "events";

export type ReportLoaderContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  searchParams: Record<string, string | undefined>;
};

// TProps mirrors whatever prop shape the report's own display component
// already takes — the generic report page spreads the loader's result
// straight into it (`<Component {...data} />`), so existing report
// components need zero changes to join the registry. The registry array
// necessarily erases TProps to `any`; each definition file stays fully
// typed at its own call site since loader and Component are declared
// together there.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReportDefinition<TProps extends object = any> = {
  slug: string;
  category: ReportCategory;
  title: string;
  description: string;
  /** One line shown on the report gallery card. */
  summary: string;
  loader: (ctx: ReportLoaderContext) => Promise<TProps>;
  Component: ComponentType<TProps>;
};
