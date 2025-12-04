declare module "jest-axe" {
  interface AxeNodeResult {
    target: string[];
    html: string;
    failureSummary?: string;
  }

  interface AxeViolation {
    id: string;
    nodes: AxeNodeResult[];
  }

  interface AxeResults {
    violations: AxeViolation[];
  }

  interface AxeRunOptions {
    rules?: Record<string, { enabled: boolean }>;
    runOnly?: string | string[] | { type: string; values: string[] };
  }

  export function axe(
    context?: Element | Document | DocumentFragment,
    options?: AxeRunOptions,
  ): Promise<AxeResults>;
}
