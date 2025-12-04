/**
 * Composition Orchestration Patterns
 *
 * This module provides patterns for composing complex UI components
 * using small, focused, reusable functions and components.
 */

import type { ReactNode } from "react";

// Core composition types
export type ComponentRenderer<T = unknown> = (props: T) => ReactNode;
export type ConditionalRenderer<T = unknown> = (props: T) => boolean;
export type ComposableProps<T = unknown> = T & {
  children?: ReactNode;
  className?: string;
};

/**
 * Conditional rendering composition
 */
export function when<T>(
  condition: ConditionalRenderer<T> | boolean,
  component: ComponentRenderer<T>,
) {
  return (props: T) => {
    const shouldRender = typeof condition === "function" ? condition(props) : condition;
    return shouldRender ? component(props) : null;
  };
}

/**
 * Component pipeline composition
 */
export function compose<T>(...renderers: ComponentRenderer<T>[]) {
  return (props: T) => (
    <>
      {renderers.map((render, index) => (
        <div key={`item-${index}`}>{render(props)}</div>
      ))}
    </>
  );
}

/**
 * Slot-based composition
 */
export function createSlotRenderer<T extends Record<string, unknown>>(
  slots: Partial<Record<keyof T, ComponentRenderer<T[keyof T]>>>,
) {
  return (props: T) => (
    <>
      {Object.entries(slots).map(([key, renderer]) => {
        const slotProps = props[key as keyof T];
        if (slotProps === undefined || !renderer) {
          return null;
        }
        const renderFn = renderer as ComponentRenderer<any>;
        return (
          <div key={key} data-slot={key}>
            {renderFn(slotProps)}
          </div>
        );
      })}
    </>
  );
}

/**
 * State-based composition orchestrator
 */
export interface StateCompositionConfig<T, S> {
  states: Record<keyof S, ConditionalRenderer<T>>;
  renderers: Record<keyof S, ComponentRenderer<T>>;
  fallback?: ComponentRenderer<T>;
}

export function createStateComposer<T, S>(config: StateCompositionConfig<T, S>) {
  return (props: T) => {
    const stateKeys = Object.keys(config.states) as Array<keyof S>;
    const activeKey = stateKeys.find((key) => {
      const condition = config.states[key];
      return condition ? condition(props) : false;
    });

    if (activeKey) {
      const renderer = config.renderers[activeKey];
      return renderer ? renderer(props) : null;
    }

    return config.fallback ? config.fallback(props) : null;
  };
}

/**
 * HOC composition helper
 */
export function withComposition<T>(
  BaseComponent: ComponentRenderer<T>,
  ...enhancers: ((component: ComponentRenderer<T>) => ComponentRenderer<T>)[]
) {
  return enhancers.reduce((component, enhancer) => enhancer(component), BaseComponent);
}

/**
 * Layout composition patterns
 */
export const LayoutComposers = {
  stack:
    (gap?: string) =>
    (...renderers: ComponentRenderer<any>[]) =>
    (props: unknown) => (
      <div className={`flex flex-col ${gap ? `gap-${gap}` : "gap-4"}`}>
        {renderers.map((render, index) => (
          <div key={`item-${index}`}>{render(props)}</div>
        ))}
      </div>
    ),

  inline:
    (gap?: string) =>
    (...renderers: ComponentRenderer<any>[]) =>
    (props: unknown) => (
      <div className={`flex flex-row items-center ${gap ? `gap-${gap}` : "gap-2"}`}>
        {renderers.map((render, index) => (
          <div key={`item-${index}`}>{render(props)}</div>
        ))}
      </div>
    ),

  grid:
    (cols: number = 2) =>
    (...renderers: ComponentRenderer<any>[]) =>
    (props: unknown) => (
      <div className={`grid grid-cols-${cols} gap-4`}>
        {renderers.map((render, index) => (
          <div key={`item-${index}`}>{render(props)}</div>
        ))}
      </div>
    ),
};

/**
 * Accessibility composition helpers
 */
export const A11yComposers = {
  withLabel:
    <T,>(labelRenderer: ComponentRenderer<T>) =>
    (component: ComponentRenderer<T>) =>
    (props: T) => (
      <div>
        {labelRenderer(props)}
        {component(props)}
      </div>
    ),

  withError:
    <T extends { error?: string }>(errorRenderer: ComponentRenderer<Pick<T, "error">>) =>
    (component: ComponentRenderer<T>) =>
    (props: T) => (
      <div>
        {component(props)}
        {props.error ? errorRenderer(props) : null}
      </div>
    ),

  withHelp:
    <T extends { help?: string }>(helpRenderer: ComponentRenderer<Pick<T, "help">>) =>
    (component: ComponentRenderer<T>) =>
    (props: T) => (
      <div>
        {component(props)}
        {props.help ? helpRenderer(props) : null}
      </div>
    ),
};

export default {
  when,
  compose,
  createSlotRenderer,
  createStateComposer,
  withComposition,
  LayoutComposers,
  A11yComposers,
};
