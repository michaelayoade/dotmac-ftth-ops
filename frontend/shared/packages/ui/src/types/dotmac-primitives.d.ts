declare module "@dotmac/primitives" {
  import type * as React from "react";

  export * from "../../../primitives/src/index.ts";

  export interface AnimatedCounterProps {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
  }

  export const AnimatedCounter: React.FC<AnimatedCounterProps>;

  export interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
    disabled?: boolean;
  }

  export const AnimatedCard: React.FC<AnimatedCardProps>;

  export interface FadeInWhenVisibleProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
  }

  export const FadeInWhenVisible: React.FC<FadeInWhenVisibleProps>;
}
