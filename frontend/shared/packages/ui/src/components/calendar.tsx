/**
 * Calendar Component
 *
 * A calendar UI component built with react-day-picker.
 * Used as the base for DatePicker and DateRangePicker.
 */

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  type ClassNames,
  type CustomComponents,
  type DateRange,
  type DayButtonProps,
  type DayPickerProps,
  type DeprecatedUI,
} from "react-day-picker";

import { cn } from "../lib/utils";

import { buttonVariants } from "./button";

export type CalendarProps = DayPickerProps;

type CalendarClassNames = Partial<ClassNames> & Partial<DeprecatedUI<string>>;

const baseClassNames: CalendarClassNames = {
  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
  month_caption: "flex justify-center pt-1 relative items-center",
  month_grid: "w-full border-collapse space-y-1",
  caption_label: "text-sm font-medium",
  nav: "space-x-1 flex items-center",
  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
  ),
  chevron: "h-4 w-4",
  weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
  day: "group h-9 w-9",
  hidden: "invisible",
  range_start: "group-data-[range_start=true]:rounded-l-md",
  range_middle:
    "group-data-[range_middle=true]:bg-accent group-data-[range_middle=true]:text-accent-foreground",
  range_end: "group-data-[range_end=true]:rounded-r-md",
  focused: "outline-none focus-visible:ring-2 focus-visible:ring-primary",
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  defaultMonth,
  month,
  mode,
  ...props
}: CalendarProps) {
  const resolvedMode = mode ?? "single";
  const mergedClassNames = React.useMemo<CalendarClassNames>(() => {
    const result: CalendarClassNames = { ...(classNames ?? {}) };
    (Object.keys(baseClassNames) as Array<keyof CalendarClassNames>).forEach((key) => {
      const baseValue = baseClassNames[key];
      const incomingValue = classNames?.[key];
      result[key] = cn(baseValue, incomingValue);
    });
    if (classNames?.caption) {
      result.month_caption = cn(
        baseClassNames.month_caption,
        classNames.caption,
        classNames.month_caption,
      );
    }
    return result;
  }, [classNames]);

  const DayButton = React.useMemo<CustomComponents["DayButton"]>(() => {
    const Button = ({ modifiers, className, children, ...rest }: DayButtonProps) => {
      return (
        <button
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
            modifiers?.["selected"] &&
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            modifiers?.["today"] && "bg-accent text-accent-foreground",
            modifiers?.["outside"] && "text-muted-foreground opacity-50",
            modifiers?.["disabled"] && "text-muted-foreground opacity-50",
            className,
          )}
          {...rest}
        >
          {children}
        </button>
      );
    };
    Button.displayName = "CalendarDayButton";
    return Button;
  }, []);

  const selectedValue = ("selected" in props ? props.selected : undefined) as
    | Date
    | Date[]
    | DateRange
    | undefined;

  const deriveSelectedMonth = (): Date | undefined => {
    if (!selectedValue) {
      return undefined;
    }

    if (resolvedMode === "single" && selectedValue instanceof Date) {
      return selectedValue;
    }

    if (resolvedMode === "multiple" && Array.isArray(selectedValue) && selectedValue.length > 0) {
      return selectedValue[0];
    }

    if (
      resolvedMode === "range" &&
      isDateRange(selectedValue) &&
      selectedValue.from instanceof Date
    ) {
      return selectedValue.from;
    }

    return undefined;
  };

  const resolvedDefaultMonth = defaultMonth ?? deriveSelectedMonth();

  const optionalMonthProps = month ? { month } : {};
  const optionalDefaultMonthProps = resolvedDefaultMonth
    ? { defaultMonth: resolvedDefaultMonth }
    : {};

  return (
    <DayPicker
      {...({
        ...props,
        mode: resolvedMode,
        ...optionalMonthProps,
        ...optionalDefaultMonthProps,
        showOutsideDays,
        className: cn("rdp p-3", className),
        classNames: mergedClassNames,
        components: {
          DayButton,
          Chevron: ({ className, orientation = "right", size = 16 }) => {
            const icons = {
              left: ChevronLeft,
              right: ChevronRight,
              up: ChevronUp,
              down: ChevronDown,
            } as const;
            const IconComponent = icons[orientation] ?? ChevronRight;
            return (
              <IconComponent
                className={cn("h-4 w-4", className)}
                style={{ width: size, height: size }}
              />
            );
          },
        },
      } as DayPickerProps)}
    />
  );
}
Calendar.displayName = "Calendar";

function isDateRange(value: unknown): value is DateRange {
  return typeof value === "object" && value !== null && "from" in value;
}

export { Calendar };
