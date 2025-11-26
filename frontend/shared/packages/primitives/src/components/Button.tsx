import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost";

type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const buttonVariants = ({ variant = "primary", size = "md" }: ButtonProps = {}) =>
  clsx(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
    {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400",
      outline: "border border-slate-200 hover:bg-slate-100",
      ghost: "hover:bg-slate-100",
    }[variant],
    {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10",
    }[size],
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonVariants({ variant, size }) + (className ? ` ${className}` : "")}
      {...props}
    />
  );
});
