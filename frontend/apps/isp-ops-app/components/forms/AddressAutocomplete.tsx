/**
 * Address Autocomplete - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared AddressAutocomplete to app-specific utilities.
 */

"use client";

import { AddressAutocomplete } from "@dotmac/features/forms";
import type { AddressComponents } from "@dotmac/features/forms";
import { cn } from "@/lib/utils";

interface AddressAutocompleteWrapperProps {
  value?: string;
  onChange?: (address: string, components?: AddressComponents) => void;
  onSelect?: (address: string, components: AddressComponents) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  apiKey?: string;
}

export function AddressAutocompleteWrapper(props: AddressAutocompleteWrapperProps) {
  return <AddressAutocomplete {...props} cn={cn} />;
}

// Default export for backward compatibility
export default AddressAutocompleteWrapper;

// Re-export types
export type { AddressComponents };
