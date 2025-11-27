"use client";

import { useState, useEffect } from "react";
import { Package, Plus, Search, Edit, Trash2, DollarSign } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTenant } from "@/lib/contexts/tenant-context";

interface Product {
  product_id: string;
  name: string;
  description?: string;
  type: "one_time" | "recurring" | "usage_based" | "tiered";
  status: "active" | "inactive" | "draft";
  currency: string;
  base_price: number;
  category_id?: string;
  features?: string[];
  metadata?: Record<string, any>;
}

interface ProductCategory {
  category_id: string;
  name: string;
  description?: string;
  product_count?: number;
}

export default function ProductCatalogPage() {
  const { tenantId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (tenantId) {
      loadCatalogData();
    }
  }, [tenantId]);

  const loadCatalogData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load products and categories
      const [productsResponse, categoriesResponse] = await Promise.all([
        apiClient.get<{ products: Product[] }>("/billing/catalog/products"),
        apiClient.get<{ categories: ProductCategory[] }>("/billing/catalog/categories"),
      ]);

      if (productsResponse.data) {
        setProducts(productsResponse.data.products || []);
      }

      if (categoriesResponse.data) {
        setCategories(categoriesResponse.data.categories || []);
      }
    } catch (error) {
      console.error("Failed to load catalog data:", error);
      setError("Failed to load catalog data");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product["description"] ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "all" || product.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "one_time":
        return "bg-blue-100 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400";
      case "recurring":
        return "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400";
      case "usage_based":
        return "bg-purple-100 dark:bg-purple-950/20 text-purple-800 dark:text-purple-400";
      case "tiered":
        return "bg-orange-100 dark:bg-orange-950/20 text-orange-800 dark:text-orange-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400";
      case "inactive":
        return "bg-red-100 dark:bg-red-950/20 text-red-800 dark:text-red-400";
      case "draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-accent rounded w-1/3"></div>
          <div className="h-32 bg-accent rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-accent rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">Error Loading Catalog</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={loadCatalogData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Product Catalog</h1>
          <p className="text-muted-foreground">
            Manage your product catalog, pricing, and billing configurations.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Package className="h-12 w-12 text-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No Products Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedCategory !== "all"
              ? "No products match your current filters."
              : "Get started by creating your first product."}
          </p>
          {!searchQuery && selectedCategory === "all" && (
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Create Your First Product
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.product_id}
              className="bg-card border border-border rounded-lg p-6 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1 text-muted-foreground hover:text-muted-foreground transition-colors">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">
                    {formatCurrency(product.base_price, product.currency)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(product.type)}`}
                  >
                    {product.type.replace("_", " ")}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}
                  >
                    {product.status}
                  </span>
                </div>

                {product.features && product.features.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {product.features.slice(0, 3).map((feature, index) => (
                        <span
                          key={index}
                          className="text-xs bg-muted text-foreground px-2 py-1 rounded"
                        >
                          {feature}
                        </span>
                      ))}
                      {product.features.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{product.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Categories Summary */}
      {categories.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.category_id} className="bg-muted rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-1">{category.name}</h3>
                {category.description && (
                  <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {category.product_count || 0} products
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
