/**
 * Combobox Component
 *
 * A searchable select component that combines input and dropdown functionality.
 * Built on top of Command component with Popover for accessibility.
 */

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;
  const triggerTextClass = cn("max-w-full truncate", !selectedOption && "text-muted-foreground");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={displayText}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span
            aria-hidden="true"
            className={triggerTextClass}
            style={{ visibility: open ? "hidden" : "visible" }}
          >
            {displayText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
                  onSelect={(currentValue: string) => {
                    onValueChange?.(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Multi-select Combobox variant
 */
export interface MultiComboboxProps extends Omit<ComboboxProps, "value" | "onValueChange"> {
  value?: string[];
  onValueChange?: (value: string[]) => void;
}

export function MultiCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  disabled = false,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<string[]>(value ?? []);
  const preventCloseRef = React.useRef(false);

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const selectedValues = internalValue;
  const selectedCount = selectedValues.length;
  const displayText = selectedCount === 0 ? placeholder : `${selectedCount} selected`;
  const triggerTextClass = cn(
    "max-w-full truncate",
    selectedCount === 0 && "text-muted-foreground",
  );

  const handleSelect = (optionValue: string) => {
    const newValue = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const handleTriggerPointerDown = () => {
    if (open) {
      preventCloseRef.current = true;
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && preventCloseRef.current) {
      preventCloseRef.current = false;
      return;
    }

    preventCloseRef.current = false;
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={displayText}
          disabled={disabled}
          onPointerDown={handleTriggerPointerDown}
          className={cn("w-full justify-between", className)}
        >
          <span
            aria-hidden="true"
            className={triggerTextClass}
            style={{ visibility: open ? "hidden" : "visible" }}
          >
            {displayText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.includes(option.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
