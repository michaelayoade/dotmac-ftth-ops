"use client";

import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { MapPin, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

// Type declaration for Google Maps API
declare const google: any;

// ============================================================================
// Types
// ============================================================================

export interface AddressComponents {
  streetNumber?: string;
  route?: string;
  locality?: string;
  administrativeAreaLevel1?: string;
  administrativeAreaLevel2?: string;
  country?: string;
  postalCode?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface CnFunction {
  (...inputs: any[]): string;
}

export interface AddressAutocompleteProps {
  value?: string;
  onChange?: (address: string, components?: AddressComponents) => void;
  onSelect?: (address: string, components: AddressComponents) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  apiKey?: string; // Google Maps API key
  cn: CnFunction;
}

/**
 * AddressAutocomplete Component
 *
 * Provides address autocomplete functionality using Google Places API.
 *
 * Features:
 * - Real-time address suggestions as you type
 * - Extracts structured address components
 * - Geocoding support (latitude/longitude)
 * - Falls back to manual entry if API key not provided
 *
 * Setup:
 * 1. Get API key from Google Cloud Console
 * 2. Enable Places API and Geocoding API
 * 3. Add API key to environment variables as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * 4. Load Google Maps script in layout or component
 */
export function AddressAutocomplete({
  value = "",
  onChange,
  onSelect,
  placeholder = "Enter address...",
  label,
  required = false,
  disabled = false,
  className,
  apiKey,
  cn,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const geocoder = useRef<any>(null);

  // Get API key from props or environment variable
  const googleApiKey = apiKey || process.env["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];

  // Load Google Maps API
  useEffect(() => {
    if (!googleApiKey) {
      console.warn("Google Maps API key not provided. Address autocomplete will use manual entry.");
      return;
    }

    // Check if Google Maps is already loaded
    if (typeof google !== "undefined" && google.maps) {
      setIsApiLoaded(true);
      autocompleteService.current = new google.maps.places.AutocompleteService();
      placesService.current = new google.maps.places.PlacesService(document.createElement("div"));
      geocoder.current = new google.maps.Geocoder();
      return;
    }

    // Load Google Maps script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsApiLoaded(true);
      autocompleteService.current = new google.maps.places.AutocompleteService();
      placesService.current = new google.maps.places.PlacesService(document.createElement("div"));
      geocoder.current = new google.maps.Geocoder();
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps API");
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(
        `script[src^="https://maps.googleapis.com/maps/api/js"]`,
      );
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [googleApiKey]);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch suggestions from Google Places API
  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || !autocompleteService.current || !isApiLoaded) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);

      try {
        const response = await new Promise<any[]>((resolve, reject) => {
          autocompleteService.current!.getPlacePredictions(
            {
              input: query,
              types: ["address"],
            },
            (predictions: any, status: any) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                resolve(predictions);
              } else {
                reject(status);
              }
            },
          );
        });

        setSuggestions(response);
      } catch (error) {
        console.error("Error fetching address suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isApiLoaded],
  );

  // Parse Google Places result into structured components
  const parseAddressComponents = (placeResult: any): AddressComponents => {
    const components: AddressComponents = {
      formattedAddress: placeResult.formatted_address,
      latitude: placeResult.geometry?.location?.lat(),
      longitude: placeResult.geometry?.location?.lng(),
    };

    placeResult.address_components?.forEach((component: any) => {
      const types = component.types;

      if (types.includes("street_number")) {
        components.streetNumber = component.long_name;
      }
      if (types.includes("route")) {
        components.route = component.long_name;
      }
      if (types.includes("locality")) {
        components.locality = component.long_name;
      }
      if (types.includes("administrative_area_level_1")) {
        components.administrativeAreaLevel1 = component.short_name;
      }
      if (types.includes("administrative_area_level_2")) {
        components.administrativeAreaLevel2 = component.long_name;
      }
      if (types.includes("country")) {
        components.country = component.long_name;
      }
      if (types.includes("postal_code")) {
        components.postalCode = component.long_name;
      }
    });

    return components;
  };

  // Handle address selection
  const handleSelectAddress = async (placeId: string, description: string) => {
    if (!placesService.current) {
      setInputValue(description);
      if (onChange) onChange(description);
      if (onSelect) onSelect(description, { formattedAddress: description });
      setShowSuggestions(false);
      return;
    }

    try {
      const result = await new Promise<any>((resolve, reject) => {
        placesService.current!.getDetails(
          {
            placeId,
            fields: ["address_components", "formatted_address", "geometry"],
          },
          (place: any, status: any) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              resolve(place);
            } else {
              reject(status);
            }
          },
        );
      });

      const addressComponents = parseAddressComponents(result);
      const formattedAddress = result.formatted_address || description;

      setInputValue(formattedAddress);
      if (onChange) onChange(formattedAddress, addressComponents);
      if (onSelect) onSelect(formattedAddress, addressComponents);
    } catch (error) {
      console.error("Error getting place details:", error);
      setInputValue(description);
      if (onChange) onChange(description);
    }

    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (onChange) onChange(newValue);

    if (newValue.trim()) {
      fetchSuggestions(newValue);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            handleSelectAddress(selected.place_id, selected.description);
          }
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className={cn("space-y-2 relative", className)}>
      {label && (
        <Label htmlFor="address-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>

        <Input
          ref={inputRef}
          id="address-input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-10"
        />

        {!isApiLoaded && googleApiKey && (
          <p className="text-xs text-muted-foreground mt-1">Loading address autocomplete...</p>
        )}

        {!googleApiKey && (
          <p className="text-xs text-muted-foreground mt-1">
            Manual address entry (Google Maps API key not configured)
          </p>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                type="button"
                onClick={() => handleSelectAddress(suggestion.place_id, suggestion.description)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2",
                  selectedIndex === index && "bg-accent",
                )}
              >
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">{suggestion.structured_formatting.main_text}</div>
                  <div className="text-xs text-muted-foreground">
                    {suggestion.structured_formatting.secondary_text}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
