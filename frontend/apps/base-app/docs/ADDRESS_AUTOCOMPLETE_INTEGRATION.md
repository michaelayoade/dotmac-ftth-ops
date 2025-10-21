# Address Autocomplete Integration Guide

## Overview

The `AddressAutocomplete` component provides Google Places API integration for intelligent address entry with the following features:

- **Real-time suggestions** as user types
- **Structured address components** extraction (street, city, state, zip, etc.)
- **Geocoding support** (latitude/longitude coordinates)
- **Graceful fallback** to manual entry if API key not configured
- **Keyboard navigation** (Arrow keys, Enter, Escape)

## Setup Instructions

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - **Places API**
   - **Geocoding API** (optional, for lat/lng)
4. Go to "Credentials" and create an API key
5. Restrict the API key:
   - Application restrictions: HTTP referrers
   - Add your domain(s): `yourdomain.com/*`, `localhost:3000/*`
   - API restrictions: Select "Places API" and "Geocoding API"

### 2. Add API Key to Environment

Create or update `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important**: The environment variable MUST start with `NEXT_PUBLIC_` to be accessible in client components.

### 3. Integration Example

#### Basic Usage

```typescript
import { AddressAutocomplete, type AddressComponents } from "@/components/forms/AddressAutocomplete";

function MyForm() {
  const [address, setAddress] = useState("");
  const [addressComponents, setAddressComponents] = useState<AddressComponents>();

  return (
    <AddressAutocomplete
      value={address}
      label="Service Address"
      placeholder="Start typing address..."
      required
      onSelect={(fullAddress, components) => {
        // Called when user selects an address from suggestions
        setAddress(fullAddress);
        setAddressComponents(components);

        console.log("Selected:", {
          fullAddress,
          street: `${components.streetNumber} ${components.route}`,
          city: components.locality,
          state: components.administrativeAreaLevel1,
          zip: components.postalCode,
          lat: components.latitude,
          lng: components.longitude,
        });
      }}
      onChange={(value, components) => {
        // Called on every keystroke
        setAddress(value);
        if (components) {
          setAddressComponents(components);
        }
      }}
    />
  );
}
```

#### Integration with CreateLeadModal

Replace the manual address inputs with AddressAutocomplete:

```typescript
// Before (manual entry):
<div className="space-y-2">
  <Label htmlFor="address_line1">
    Service Address <span className="text-destructive">*</span>
  </Label>
  <Input
    id="address_line1"
    value={formData.service_address_line1}
    onChange={(e) => setFormData({ ...formData, service_address_line1: e.target.value })}
    placeholder="123 Main Street"
    required
  />
</div>

// After (with autocomplete):
<AddressAutocomplete
  value={formData.service_address_line1}
  label="Service Address"
  placeholder="Start typing address..."
  required
  onSelect={(address, components) => {
    setFormData({
      ...formData,
      service_address_line1: `${components?.streetNumber || ""} ${components?.route || ""}`.trim() || address,
      service_city: components?.locality || "",
      service_state_province: components?.administrativeAreaLevel1 || "",
      service_postal_code: components?.postalCode || "",
      // Optional: store lat/lng if your backend supports it
      // latitude: components?.latitude,
      // longitude: components?.longitude,
    });
  }}
/>
```

### 4. Address Components Reference

The `AddressComponents` interface provides:

```typescript
interface AddressComponents {
  streetNumber?: string; // "123"
  route?: string; // "Main Street"
  locality?: string; // "San Francisco" (city)
  administrativeAreaLevel1?: string; // "CA" (state/province - short name)
  administrativeAreaLevel2?: string; // "San Francisco County" (county)
  country?: string; // "United States"
  postalCode?: string; // "94102"
  formattedAddress?: string; // "123 Main St, San Francisco, CA 94102, USA"
  latitude?: number; // 37.7749
  longitude?: number; // -122.4194
}
```

## Component Props

```typescript
interface AddressAutocompleteProps {
  value?: string; // Current address value
  onChange?: (address: string, components?: AddressComponents) => void;
  onSelect?: (address: string, components: AddressComponents) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  apiKey?: string; // Optional: override environment variable
}
```

## Features

### Keyboard Navigation

- **Arrow Down**: Move to next suggestion
- **Arrow Up**: Move to previous suggestion
- **Enter**: Select highlighted suggestion
- **Escape**: Close suggestions dropdown

### Loading States

- Shows spinner icon while fetching suggestions
- Map pin icon when idle
- Loading message while Google Maps API loads

### Graceful Degradation

If Google Maps API key is not configured:

- Component still renders as a normal input
- Shows helpful message: "Manual address entry (Google Maps API key not configured)"
- All form functionality works normally

## Testing Without API Key

The component works perfectly fine without an API key - it simply becomes a regular text input. This is useful for:

- Local development without API key
- Testing in environments without API access
- Providing fallback for production if API quota exceeded

## Cost Considerations

Google Places Autocomplete pricing (as of 2024):

- **Autocomplete - Per Session**: $2.83 per 1000 requests
- **Geocoding**: $5.00 per 1000 requests

A "session" is one complete address selection (all keystrokes + final selection count as 1 session).

**Budget-friendly tips:**

- Use session-based pricing (default in this component)
- Implement debouncing (add if needed)
- Set up billing alerts in Google Cloud Console
- Consider caching common addresses

## Migration Guide

### Migrating CreateLeadModal

1. Import the component:

```typescript
import {
  AddressAutocomplete,
  type AddressComponents,
} from "@/components/forms/AddressAutocomplete";
```

2. Replace manual address line 1 input with AddressAutocomplete

3. Keep city, state, zip inputs for user verification (populate from components)

4. Test with and without API key

### Migrating AddSubscriberModal

Same process as CreateLeadModal - replace service_address field with AddressAutocomplete.

## Troubleshooting

### "Loading address autocomplete..." never finishes

**Cause**: Google Maps script failed to load
**Solutions**:

- Check API key is valid
- Verify Places API is enabled
- Check browser console for errors
- Verify API key restrictions allow your domain

### Suggestions not appearing

**Cause**: API request failed or no results
**Solutions**:

- Open browser network tab and check for 403/400 errors
- Verify API key has Places API enabled
- Check API key restrictions
- Ensure billing is enabled on Google Cloud project

### "RefererNotAllowedMapError"

**Cause**: API key HTTP referrer restrictions don't match your domain
**Solutions**:

- Add your domain to API key restrictions in Google Cloud Console
- For development: Add `localhost:3000/*`
- For production: Add `yourdomain.com/*`

## Advanced Usage

### Custom API Key per Tenant

```typescript
<AddressAutocomplete
  value={address}
  apiKey={tenant.googleMapsApiKey} // Use tenant-specific key
  onSelect={handleSelect}
/>
```

### Debouncing for Cost Optimization

```typescript
import { useDebouncedCallback } from "use-debounce";

const debouncedOnChange = useDebouncedCallback(
  (value) => {
    // Fetch suggestions
  },
  300, // Wait 300ms after user stops typing
);
```

### Filtering by Country

To restrict suggestions to specific countries, modify the component's `fetchSuggestions` function:

```typescript
autocompleteService.current!.getPlacePredictions(
  {
    input: query,
    types: ["address"],
    componentRestrictions: { country: "us" }, // Add this line
  },
  // ...
);
```

## Future Enhancements

Potential improvements:

- [ ] Built-in debouncing
- [ ] Country/region filtering via props
- [ ] Support for business/establishment addresses
- [ ] Caching layer for common addresses
- [ ] Accessibility improvements (ARIA labels)
- [ ] Unit tests

## Related Files

- Component: `components/forms/AddressAutocomplete.tsx`
- Integration examples:
  - `components/crm/CreateLeadModal.tsx` (candidate)
  - `components/crm/AddSubscriberModal.tsx` (candidate)
- Documentation: `docs/ADDRESS_AUTOCOMPLETE_INTEGRATION.md` (this file)
