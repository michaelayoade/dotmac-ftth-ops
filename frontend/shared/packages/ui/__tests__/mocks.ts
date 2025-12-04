/**
 * Mock implementations for testing @dotmac/primitives
 */

// Mock components and utilities
export const Button = jest.fn(({ children, ...props }) => children);
export const Input = jest.fn(({ children, ...props }) => children);
export const Card = jest.fn(({ children, ...props }) => children);
export const Modal = jest.fn(({ children, ...props }) => children);
export const buttonVariants = jest.fn(() => "mocked-button-variant");

// Mock types (these will be available at runtime)
export type ButtonProps = any;
export type UniversalThemeConfig = any;
