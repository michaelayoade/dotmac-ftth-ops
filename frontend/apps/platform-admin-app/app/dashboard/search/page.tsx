"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * Global Search Page
 *
 * Comprehensive search interface for finding any entity across the tenant's data.
 * Supports filtering by type, pagination, and provides relevance-scored results.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  User,
  Users,
  Ticket,
  Receipt,
  Server,
  ShoppingCart,
  Clock,
} from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import type { SearchResult } from "@/types/search";
import { TYPE_COLORS, SEARCH_ENTITY_TYPES, formatEntityType, getEntityRoute } from "@/types/search";

// Entity type icons
const TYPE_ICONS: Record<string, any> = {
  customer: Users,
  subscriber: User,
  invoice: Receipt,
  ticket: Ticket,
  user: User,
  device: Server,
  service: Sparkles,
  order: ShoppingCart,
};

export default function GlobalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get query parameters from URL
  const queryFromUrl = searchParams.get("q") || "";
  const typeFromUrl = searchParams.get("type") || "";
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);

  const [query, setQuery] = useState(queryFromUrl);
  const [selectedType, setSelectedType] = useState<string>(typeFromUrl);
  const [currentPage, setCurrentPage] = useState(pageFromUrl);
  const [searchInput, setSearchInput] = useState(queryFromUrl);

  // Perform search
  const {
    data: searchResults,
    isLoading,
    error,
  } = useSearch(
    {
      q: query,
      type: selectedType || undefined,
      limit: 20,
      page: currentPage,
    },
    !!query,
  );

  // Update URL when search parameters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedType) params.set("type", selectedType);
    if (currentPage > 1) params.set("page", currentPage.toString());

    const newUrl = params.toString()
      ? `/dashboard/search?${params.toString()}`
      : "/dashboard/search";
    router.replace(newUrl);
  }, [query, selectedType, currentPage, router]);

  // Sync URL params back to state
  useEffect(() => {
    setQuery(queryFromUrl);
    setSearchInput(queryFromUrl);
    setSelectedType(typeFromUrl);
    setCurrentPage(pageFromUrl);
  }, [queryFromUrl, typeFromUrl, pageFromUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
    setSelectedType("");
    setCurrentPage(1);
  };

  const handleTypeFilter = (type: string) => {
    if (selectedType === type) {
      setSelectedType("");
    } else {
      setSelectedType(type);
    }
    setCurrentPage(1);
  };

  const totalPages = searchResults ? Math.ceil(searchResults.total / 20) : 0;

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="h-8 w-8" />
          Global Search
        </h1>
        <p className="text-muted-foreground mt-1">
          Search across all your customers, invoices, tickets, and more
        </p>
      </div>

      {/* Search Bar */}
      <Card className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for anything..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-10 py-3 w-full border rounded-lg text-lg"
                autoFocus
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <Button type="submit" size="lg" disabled={!searchInput.trim()}>
              <Search className="mr-2 h-5 w-5" />
              Search
            </Button>
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-2">Filter by type:</span>
            {Object.entries(SEARCH_ENTITY_TYPES).map(([key, value]) => {
              const Icon = TYPE_ICONS[value] || FileText;
              const count = searchResults?.facets?.types?.[value] || 0;

              return (
                <Button
                  key={value}
                  type="button"
                  variant={selectedType === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTypeFilter(value)}
                  disabled={!query || count === 0}
                >
                  <Icon className="mr-1 h-3 w-3" />
                  {formatEntityType(value)}
                  {count > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
            {selectedType && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedType("");
                  setCurrentPage(1);
                }}
              >
                Clear Filter
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Search Results */}
      {!query ? (
        <Card className="p-12 text-center">
          <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start Searching</h3>
          <p className="text-muted-foreground">
            Enter a search term above to find customers, invoices, tickets, and more across your
            entire system.
          </p>
        </Card>
      ) : isLoading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Searching...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-800">Error performing search: {error.message}</p>
        </Card>
      ) : searchResults && searchResults.results.length === 0 ? (
        <Card className="p-12 text-center">
          <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
          <p className="text-muted-foreground mb-4">
            No results found for <strong>{query}</strong>
            {selectedType && ` in ${formatEntityType(selectedType)}`}
          </p>
          <Button variant="outline" onClick={clearSearch}>
            Clear Search
          </Button>
        </Card>
      ) : searchResults ? (
        <>
          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found <strong>{searchResults.total}</strong> results for <strong>{query}</strong>
              {selectedType && ` in ${formatEntityType(selectedType)}`}
            </p>
            {totalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {searchResults.results.map((result) => (
              <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// ============================================================================
// Search Result Card Component
// ============================================================================

function SearchResultCard({ result }: { result: SearchResult }) {
  const Icon = TYPE_ICONS[result.type] || FileText;
  const typeColor = TYPE_COLORS[result.type] || TYPE_COLORS.unknown;
  const detailRoute = getEntityRoute(result.type, result.id);

  return (
    <Link href={detailRoute}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <Icon className="h-6 w-6 text-gray-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{result.title}</h3>
                <Badge className={`${typeColor} mt-1`}>{formatEntityType(result.type)}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                <Clock className="h-3 w-3" />
                Score: {result.score.toFixed(2)}
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">{result.content}</p>

            {/* Metadata */}
            {Object.keys(result.metadata).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(result.metadata)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key} className="text-xs px-2 py-1 bg-gray-100 rounded">
                      <strong>{key}:</strong> {String(value)}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
