declare module "jest-axe" {
  import { AxeResults, RunOptions, Spec } from "axe-core";

  export function configureAxe(
    options?: RunOptions & { globalOptions?: Spec },
  ): (html: Element | Document, options?: RunOptions) => Promise<AxeResults>;

  export function toHaveNoViolations(): any;

  export const axe: ReturnType<typeof configureAxe>;
}
