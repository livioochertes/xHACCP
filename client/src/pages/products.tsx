import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Filter, Grid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

import ProductCard from "@/components/product-card";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import type { Category, ProductWithCategory } from "@shared/schema";

export default function Products() {
  const [location, navigate] = useLocation();
  const { t } = useTranslation();
  
  // Parse URL parameters and track location changes to force re-render
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [urlChangeCounter, setUrlChangeCounter] = useState(0);
  
  // Update URL parameters when location changes OR when URL changes via navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const newSearchQuery = urlParams.get("search") || "";
    const newSelectedCategory = urlParams.get("category") || "";
    
    console.log("📍 Location changed:", window.location.href, "Search:", newSearchQuery, "Category:", newSelectedCategory);
    
    // Always update to ensure sync
    setSearchQuery(newSearchQuery);
    setSelectedCategory(newSelectedCategory);
    setCurrentLimit(20); // Reset limit when category changes
    
    // Force query to refresh by completely clearing cache
    queryClient.clear();
    // Also remove any React Query cache
    queryClient.removeQueries({ queryKey: ["/api/products"] });
  }, [location, urlChangeCounter]);

  // Also listen for URL changes via popstate (back/forward buttons) and custom events
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newSearchQuery = urlParams.get("search") || "";
      const newSelectedCategory = urlParams.get("category") || "";
      
      console.log("🔄 URL event - URL changed:", window.location.href);
      
      setSearchQuery(newSearchQuery);
      setSelectedCategory(newSelectedCategory);
      setCurrentLimit(20); // Reset limit when URL changes
      setUrlChangeCounter(prev => prev + 1);
      
      queryClient.clear();
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('urlchange', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('urlchange', handleUrlChange);
    };
  }, []);
  
  console.log("🔍 Products component render:", {
    location,
    searchQuery,
    selectedCategory,
    timestamp: new Date().toISOString()
  });
  
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: Infinity, // Never consider data stale
    gcTime: Infinity, // Never garbage collect
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    networkMode: 'offlineFirst', // Prefer cached data

  });

  const { getCategoryName: getTranslatedCategoryName } = useCategoryTranslations(
    categories.map(c => c.id)
  );

  const getCategoryName = (category: Category | null | undefined) => {
    if (!category) return '';
    return getTranslatedCategoryName(category.id, category.name);
  };

  // Server-side caching handles prefetching, no need for client-side prefetch

  const [currentLimit, setCurrentLimit] = useState(20);
  
  const { data: products = [], isLoading, isFetching, isPlaceholderData } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", { 
      search: searchQuery || undefined,
      categorySlug: selectedCategory || undefined,
      limit: currentLimit
    }],
    staleTime: 0, // Always fresh data
    gcTime: 0, // Don't cache at all
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    enabled: true, // Always enabled to ensure queries run

  });

  // Log products data for debugging
  useEffect(() => {
    console.log("🔄 Products data:", {
      productsLength: products?.length || 0,
      isLoading,
      isFetching,
      products: products?.slice(0, 5).map(p => ({ id: p.id, name: p.name })) || [],
      actualArrayLength: Array.isArray(products) ? products.length : 0,
      timestamp: new Date().toISOString()
    });
  }, [products, isLoading, isFetching]);

  // Check if there are more products to load
  const hasMoreProducts = products.length >= currentLimit;
  
  const handleLoadMore = () => {
    setCurrentLimit(prev => prev + 20);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newSearch = formData.get("search") as string;
    
    console.log("🔍 Search form submitted:", newSearch);
    const startTime = performance.now();
    
    // Update URL with search params
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    if (selectedCategory) params.set("category", selectedCategory);
    const newUrl = `/products${params.toString() ? `?${params.toString()}` : ""}`;
    navigate(newUrl);
    
    console.log("⏱️ Search navigation initiated:", performance.now() - startTime, "ms");
  };

  // Removed client-side sorting for better performance - server should handle this



  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="w-full lg:w-1/4">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  {t('common.filters')}
                </h3>

                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="mb-6">
                  <div className="relative">
                    <Input
                      name="search"
                      type="text"
                      placeholder={t('search.placeholder')}
                      defaultValue={searchQuery}
                      className="pl-10"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </form>

                {/* Categories */}
                <div className="mb-6">
                  <h4 className="font-medium mb-3">{t('nav.categories')}</h4>
                  <div className="space-y-2">
                    <Button
                      variant={selectedCategory === "" ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        console.log("🚀 Sidebar All Products clicked");
                        const startTime = performance.now();
                        const params = new URLSearchParams();
                        if (searchQuery) params.set("search", searchQuery);
                        const newUrl = `/products${params.toString() ? `?${params.toString()}` : ""}`;
                        console.log("🎯 Sidebar navigating to:", newUrl);
                        navigate(newUrl);
                        console.log("⏱️ Sidebar navigation initiated:", performance.now() - startTime, "ms");
                        console.log("🔗 Current URL after navigation:", window.location.href);
                        
                        // Force a re-render by dispatching a custom event
                        window.dispatchEvent(new CustomEvent('urlchange'));
                      }}
                    >
                      {t('nav.products')}
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.slug ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          console.log("🚀 Sidebar category clicked:", category.name);
                          const startTime = performance.now();
                          const params = new URLSearchParams();
                          if (searchQuery) params.set("search", searchQuery);
                          params.set("category", category.slug);
                          const newUrl = `/products?${params.toString()}`;
                          console.log("🎯 Sidebar navigating to:", newUrl);
                          navigate(newUrl);
                          console.log("⏱️ Sidebar navigation initiated:", performance.now() - startTime, "ms");
                          console.log("🔗 Current URL after navigation:", window.location.href);
                          
                          // Force a re-render by dispatching a custom event
                          window.dispatchEvent(new CustomEvent('urlchange'));
                        }}
                      >
                        {getCategoryName(category)}
                        {selectedCategory === category.slug && isLoading && (
                          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <h4 className="font-medium mb-3">{t('common.sortBy')}</h4>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t('products.sortNewest')}</SelectItem>
                      <SelectItem value="price-asc">{t('products.sortPriceAsc')}</SelectItem>
                      <SelectItem value="price-desc">{t('products.sortPriceDesc')}</SelectItem>
                      <SelectItem value="name">{t('products.sortName')}</SelectItem>
                      <SelectItem value="rating">{t('products.sortRating')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="w-full lg:w-3/4">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-primary flex items-center">
                  {selectedCategory
                    ? getCategoryName(categories.find(c => c.slug === selectedCategory)) || t('nav.products')
                    : searchQuery
                    ? `${t('search.results')} "${searchQuery}"`
                    : t('nav.products')
                  }
                  {(isLoading || isFetching) && (
                    <div className="ml-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
                  )}
                </h1>
                <Badge variant="secondary">
                  {products.length} {t('nav.products').toLowerCase()}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Loading State - Only show when no previous data */}
            {isLoading && !products.length && (
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-6 w-1/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* No Results */}
            {!isLoading && !isFetching && products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t('products.noProducts')}</p>
                <Button onClick={() => { window.location.href = "/products"; }}>
                  {t('products.clearFilters')}
                </Button>
              </div>
            )}

            {/* Products Grid */}
            {products.length > 0 && (
              <>
                <div className={`grid gap-6 ${
                  viewMode === "grid" 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                    : "grid-cols-1"
                }`}>
                  {products.map((product) => (
                    <ProductCard key={`${product.id}-${selectedCategory}-${searchQuery}`} product={product} />
                  ))}
                </div>
                
                {/* Load More Button */}
                {hasMoreProducts && (
                  <div className="flex justify-center mt-8">
                    <Button 
                      onClick={handleLoadMore} 
                      disabled={isFetching}
                      size="lg"
                      className="px-8"
                    >
                      {isFetching ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white"></div>
                          Loading more...
                        </>
                      ) : (
                        <>Load More Products</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
