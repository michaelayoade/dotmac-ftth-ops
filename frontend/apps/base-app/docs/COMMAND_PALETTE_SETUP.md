# Command Palette (⌘K) Setup Guide

## Overview

The Global Command Palette provides keyboard-driven navigation and search across your entire application. Users can quickly access any page or search for entities using a single keyboard shortcut.

**Keyboard Shortcut:**
- Mac: `⌘K` (Command + K)
- Windows/Linux: `Ctrl+K`

---

## Installation

### 1. Install Required Dependencies

The command palette requires the `cmdk` package (Command Menu for React):

```bash
pnpm add cmdk
```

If you're using Radix UI Dialog (for the modal):

```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-icons
```

### 2. Verify Files Created

The following files have been created:

```
components/
├── ui/
│   └── command.tsx                    # Base Command component (shadcn/ui style)
└── global-command-palette.tsx         # Global Command Palette implementation

app/
└── dashboard/
    └── layout.tsx                      # Updated with <GlobalCommandPalette />
```

### 3. Package.json Update

Add the following to your `package.json` if not already present:

```json
{
  "dependencies": {
    "cmdk": "^0.2.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-icons": "^1.3.0"
  }
}
```

---

## Features

### 1. **Quick Navigation**
Navigate to common pages instantly:
- 📊 Dashboard
- 🔍 Search Page
- 👥 Subscribers
- 💰 Billing & Revenue
- 🎫 Support Tickets
- 🖥️ Network Inventory
- 📧 Communications
- 🛡️ Audit & Compliance
- ⚙️ Settings

### 2. **Global Search Integration**
- Real-time search across all entities
- Debounced search (300ms delay)
- Displays: Customers, Invoices, Tickets, Devices, Services, etc.
- Shows relevance score for each result
- Entity type badges

### 3. **Recent Searches**
- Stores last 5 searches in localStorage
- Quick access to previous searches
- Automatically saved when selecting search results

### 4. **Keyboard Navigation**
- `⌘K` / `Ctrl+K` - Open/Close palette
- `↑` `↓` - Navigate items
- `Enter` - Select item
- `Esc` - Close palette
- Type to search/filter

### 5. **Visual Feedback**
- Loading spinner during search
- Empty states with helpful messages
- Entity type icons and colors
- Keyboard shortcut hints

---

## Usage

### Opening the Command Palette

**From anywhere in the dashboard:**
- Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux)

### Quick Navigation

1. Open palette (`⌘K`)
2. Start typing: "bill", "subscr", "audit", etc.
3. Use arrow keys to select
4. Press `Enter` to navigate

### Searching for Entities

1. Open palette (`⌘K`)
2. Type search query: "john doe", "invoice", "ticket #123"
3. Results appear in real-time (debounced)
4. Each result shows:
   - Entity icon
   - Title
   - Type badge
   - Preview content
   - Relevance score
5. Press `Enter` to navigate to entity detail page

### Recent Searches

1. Open palette without typing
2. See "Recent Searches" section
3. Click any recent search to repeat it

---

## Architecture

### Component Structure

```
GlobalCommandPalette
├── CommandDialog (modal wrapper)
│   ├── CommandInput (search input)
│   └── CommandList (results container)
│       ├── CommandEmpty (no results state)
│       ├── CommandGroup ("Recent Searches")
│       ├── CommandGroup ("Quick Actions")
│       └── CommandGroup ("Search Results")
```

### Data Flow

```
User presses ⌘K
    ↓
GlobalCommandPalette opens
    ↓
User types query
    ↓
useDebouncedSearch hook (300ms debounce)
    ↓
searchService.search() API call
    ↓
Results displayed with icons & badges
    ↓
User selects result
    ↓
Navigate to entity detail page
    ↓
Save to recent searches
```

### Integration Points

1. **Search Hook**: `useDebouncedSearch` from `@/hooks/useSearch.ts`
2. **Search Service**: `searchService` from `@/lib/services/search-service.ts`
3. **Routing**: Uses Next.js `useRouter` for navigation
4. **Storage**: `localStorage` for recent searches
5. **Types**: `@/types/search.ts` for type definitions

---

## Customization

### Adding Quick Actions

Edit `/components/global-command-palette.tsx`:

```tsx
const quickActions: QuickAction[] = [
  // ... existing actions
  {
    id: 'my-custom-page',
    label: 'My Custom Page',
    icon: MyIcon,
    shortcut: '⌘M',
    action: () => router.push('/dashboard/my-page'),
    keywords: ['custom', 'my', 'page'],
  },
];
```

### Changing Keyboard Shortcut

Edit the keyboard listener in `global-command-palette.tsx`:

```tsx
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    // Change 'k' to your preferred key
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((open) => !open);
    }
  };
  // ...
}, []);
```

### Adjusting Search Debounce

Edit the hook usage:

```tsx
// Change from 300ms to 500ms
const { results, isLoading } = useDebouncedSearch(searchQuery, undefined, 500);
```

### Styling

The component uses Tailwind CSS classes. Customize colors in:
- `components/ui/command.tsx` - Base command component styles
- `components/global-command-palette.tsx` - Palette-specific styles

---

## Testing

### Manual Testing

1. **Open Palette:**
   - Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux)
   - Verify modal opens

2. **Quick Navigation:**
   - Type "dash" → Should show "Go to Dashboard"
   - Type "bill" → Should show "Billing & Revenue"
   - Press Enter → Should navigate

3. **Search:**
   - Type "john" → Should show search results
   - Verify loading spinner appears
   - Verify results have icons and badges
   - Click result → Should navigate to detail page

4. **Recent Searches:**
   - Search for something and select a result
   - Close and reopen palette
   - Verify search appears in "Recent Searches"

5. **Keyboard Navigation:**
   - Open palette
   - Use ↑↓ arrows to navigate
   - Press Enter to select
   - Press Esc to close

### Automated Testing

See `tests/e2e/test_ui_integrations.spec.ts` for comprehensive integration tests.

---

## Troubleshooting

### "cmdk not found" Error

**Solution:** Install the package:
```bash
pnpm add cmdk
```

### Keyboard Shortcut Not Working

**Possible causes:**
1. Another extension/app is using ⌘K
2. Check browser console for errors
3. Verify `GlobalCommandPalette` is rendered in layout

**Solution:**
- Change keyboard shortcut to different key
- Disable conflicting extensions

### Search Results Not Appearing

**Possible causes:**
1. Backend API not running
2. Search service not configured
3. Network error

**Solution:**
- Check browser Network tab for API calls
- Verify `/api/v1/search` endpoint is accessible
- Check backend logs

### Recent Searches Not Saving

**Possible causes:**
1. localStorage blocked (private browsing)
2. Browser storage quota exceeded

**Solution:**
- Disable private browsing mode
- Clear browser storage
- Check console for localStorage errors

---

## Performance Considerations

1. **Debounced Search**: 300ms delay prevents excessive API calls
2. **React Query Caching**: Search results cached for 30 seconds
3. **Lazy Loading**: Command palette only loaded when opened
4. **Recent Searches Limit**: Max 5 items to prevent localStorage bloat

---

## Accessibility

The command palette follows accessibility best practices:

- ✅ Keyboard navigation (arrows, enter, escape)
- ✅ Focus management (auto-focus on input)
- ✅ Screen reader support (ARIA labels)
- ✅ High contrast mode compatible
- ✅ Reduced motion support

---

## Future Enhancements

Potential improvements:

1. **Command History**: Track command usage frequency
2. **Smart Suggestions**: AI-powered command suggestions
3. **Aliases**: Custom command aliases
4. **Command Categories**: Group commands by category
5. **Multi-step Commands**: Wizard-style command flows
6. **Command API**: Allow plugins to register commands
7. **Search Filters**: Advanced filtering in search
8. **Fuzzy Search**: Better search matching
9. **Themes**: Custom color themes for palette
10. **Analytics**: Track command usage

---

## Related Documentation

- [Global Search Implementation](/docs/UI_IMPLEMENTATION_STATUS.md)
- [React Query Hooks](/hooks/useSearch.ts)
- [Search Service](/lib/services/search-service.ts)
- [Search Types](/types/search.ts)

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review browser console for errors
3. Check backend API logs
4. Verify all dependencies installed

**Happy commanding! ⌘K** 🚀
