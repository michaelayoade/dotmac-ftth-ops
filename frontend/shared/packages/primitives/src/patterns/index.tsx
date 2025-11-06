import type React from "react";

/**
 * Design Patterns for Component Composition
 *
 * This module exports all composition patterns and orchestration utilities
 * for building complex UI components from simple, focused functions.
 */

// Core composition utilities
export * from "./composition";

// Usage examples and best practices
export const CompositionPatterns = {
  // Example: State-based rendering
  createLoadingState: () => ({
    loading: () => <div>Loading...</div>,
    error: (error: string) => <div>Error: {error}</div>,
    success: (data: unknown) => <div>Data: {JSON.stringify(data)}</div>,
  }),

  // Example: Form field composition
  createFieldComposition: () => ({
    label: (text: string) => (
      <label htmlFor={`input-${Math.random().toString(36).substr(2, 9)}`}>{text}</label>
    ),
    input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    error: (message: string) => <span className="error">{message}</span>,
    help: (text: string) => <span className="help">{text}</span>,
  }),

  // Example: Layout composition
  createLayoutComposition: () => ({
    header: (content: React.ReactNode) => <header>{content}</header>,
    main: (content: React.ReactNode) => <main>{content}</main>,
    sidebar: (content: React.ReactNode) => <aside>{content}</aside>,
    footer: (content: React.ReactNode) => <footer>{content}</footer>,
  }),
};

// Best practices documentation
export const CompositionBestPractices = {
  principles: [
    "Favor composition over inheritance",
    "Keep components small and focused",
    "Use render props and higher-order components judiciously",
    "Leverage TypeScript for better composition safety",
    "Test composition patterns independently",
  ],

  patterns: {
    "State-based": "Use createStateComposer for conditional rendering based on component state",
    "Layout-based": "Use LayoutComposers for consistent spacing and arrangement",
    "Slot-based": "Use createSlotRenderer for flexible content areas",
    "Function-based": "Use when() for conditional rendering logic",
  },

  antipatterns: [
    "Avoid deeply nested component hierarchies",
    "Do not over-abstract simple components",
    "Avoid composition for static content",
    "Do not use composition to bypass TypeScript safety",
  ],
};
