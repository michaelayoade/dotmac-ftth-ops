/// <reference types="jest" />
import { JestAxeConfigureOptions } from "jest-axe";

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}

export {};
