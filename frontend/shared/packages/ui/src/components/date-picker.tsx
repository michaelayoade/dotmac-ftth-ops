/**
 * DatePicker Components
 *
 * Calendar-based date selection components built with react-day-picker.
 * Provides both single date and date range selection.
 */

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { cn } from "../lib/utils";

import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (selectedDate?: Date) => {
      onDateChange?.(selectedDate);
      setOpen(false);
    },
    [onDateChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal border-input",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            format(date, "PPP")
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          required={false}
          initialFocus={true}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Pick a date range",
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const handleRangeSelect = React.useCallback(
    (range?: DateRange) => {
      onDateRangeChange?.(range);
    },
    [onDateRangeChange],
  );

  React.useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      setOpen(false);
    }
  }, [dateRange?.from, dateRange?.to]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal border-input",
            !dateRange && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
              </>
            ) : (
              format(dateRange.from, "LLL dd, y")
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus={true}
          mode="range"
          {...(dateRange?.from ? { defaultMonth: dateRange.from } : {})}
          required={false}
          selected={dateRange}
          onSelect={handleRangeSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
