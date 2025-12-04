/**
 * Global Command Palette
 *
 * Keyboard-driven command palette with global search integration.
 * Accessible via Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 *
 * Features:
 * - Global search across all entities
 * - Quick navigation to common pages
 * - Recent searches
 * - Keyboard shortcuts
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@dotmac/ui";
import {
  Search,
  Home,
  Users,
  Receipt,
  Ticket,
  Server,
  Mail,
  Shield,
  Settings,
  FileText,
  Activity,
  Package,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useDebouncedSearch } from "@/hooks/useSearch";
import { getEntityRoute, formatEntityType } from "@/types/search";
import { Badge } from "@dotmac/ui";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounced search results
  const { data: results, isLoading } = useDebouncedSearch(searchQuery);

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  // Save search to recent
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((q) => q !== query)].slice(0, 5);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Quick actions - ISP Operations workspace
  const quickActions: QuickAction[] = [
    {
      id: "home",
      label: "Overview Dashboard",
      icon: Home,
      shortcut: "⌘H",
      action: () => router.push("/dashboard"),
      keywords: ["home", "dashboard", "overview"],
    },
    {
      id: "crm",
      label: "CRM Workspace",
      icon: Users,
      action: () => router.push("/dashboard/crm"),
      keywords: ["crm", "leads", "contacts", "sales"],
    },
    {
      id: "subscribers",
      label: "Subscribers",
      icon: Users,
      action: () => router.push("/dashboard/subscribers"),
      keywords: ["subscribers", "radius", "accounts", "customers"],
    },
    {
      id: "network",
      label: "Network Inventory",
      icon: Server,
      action: () => router.push("/dashboard/network"),
      keywords: ["network", "devices", "infrastructure", "ipam"],
    },
    {
      id: "fiber",
      label: "Fiber Management",
      icon: Activity,
      action: () => router.push("/dashboard/network/fiber"),
      keywords: ["fiber", "cables", "optical", "infrastructure"],
    },
    {
      id: "operations",
      label: "Operations Center",
      icon: Activity,
      action: () => router.push("/dashboard/operations"),
      keywords: ["operations", "automation", "workflows"],
    },
    {
      id: "billing",
      label: "Billing & Revenue",
      icon: Receipt,
      action: () => router.push("/dashboard/billing-revenue"),
      keywords: ["billing", "invoices", "revenue", "payments", "subscriptions"],
    },
    {
      id: "tickets",
      label: "Tickets",
      icon: Ticket,
      action: () => router.push("/dashboard/ticketing"),
      keywords: ["tickets", "support", "help", "issues"],
    },
    {
      id: "communications",
      label: "Communications",
      icon: Mail,
      action: () => router.push("/dashboard/communications"),
      keywords: ["email", "sms", "communications", "messages", "campaigns"],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      action: () => router.push("/dashboard/settings"),
      keywords: ["settings", "preferences", "configuration", "account"],
    },
  ];

  // Handle item selection
  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false);
    callback();
  }, []);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (entityType: string, entityId: string, title: string) => {
      saveRecentSearch(title);
      const route = getEntityRoute(entityType, entityId);
      handleSelect(() => router.push(route));
    },
    [handleSelect, router, saveRecentSearch],
  );

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback((query: string) => {
    setSearchQuery(query);
    // Don't close, let user see results
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search anything or type a command..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <div className="py-6">
              <p className="text-sm text-muted-foreground">No results found.</p>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mt-2">
                  Try adjusting your search query
                </p>
              )}
            </div>
          )}
        </CommandEmpty>

        {/* Recent Searches */}
        {!searchQuery && recentSearches.length > 0 && (
          <>
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search, index) => (
                <CommandItem
                  key={`recent-${index}`}
                  onSelect={() => handleRecentSearchSelect(search)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{search}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {!searchQuery && (
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  onSelect={() => handleSelect(action.action)}
                  {...(action.keywords ? { keywords: action.keywords } : {})}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{action.label}</span>
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Search Results */}
        {searchQuery && results?.results && results.results.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Search Results">
              {results.results.map((result: any) => {
                // Determine icon based on entity type
                const Icon =
                  result.type === "customer"
                    ? Users
                    : result.type === "invoice"
                      ? Receipt
                      : result.type === "ticket"
                        ? Ticket
                        : result.type === "device"
                          ? Server
                          : result.type === "service"
                            ? Package
                            : FileText;

                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSearchResultSelect(result.type, result.id, result.title)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{result.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatEntityType(result.type)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {result.content}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                      <TrendingUp className="h-3 w-3" />
                      {result.score.toFixed(2)}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Helper text */}
        {!searchQuery && (
          <>
            <CommandSeparator />
            <div className="p-2 text-xs text-muted-foreground text-center">
              <p>
                Press <kbd className="px-1 py-0.5 bg-muted rounded">⌘K</kbd> to open •{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded">↑</kbd>
                <kbd className="px-1 py-0.5 bg-muted rounded">↓</kbd> to navigate •{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to select •{" "}
                <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to close
              </p>
            </div>
          </>
        )}

        {/* Clear search button */}
        {searchQuery && (
          <div className="p-2 border-t">
            <button
              onClick={handleClearSearch}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear search
            </button>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
