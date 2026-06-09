import { useState, useEffect, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Filter, Grid, List, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { usePageSeo } from "@/lib/use-page-seo";

import ProductCard from "@/components/product-card";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import type { Category, ProductWithCategory } from "@shared/schema";

const PAGE_SIZE = 20;

export default function Products() {
  const [location, navigate] = useLocation();
  const { t } = useTranslation();

  usePageSeo({
    title: "Catalog Produse HACCP & HoReCa | xHACCP",
    description: "Explorează catalogul complet de echipamente și consumabile HACCP profesionale. Etichete HACCP, ustensile bucătărie, soluții pentru restaurante și HoReCa.",
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [urlChangeCounter, setUrlChangeCounter] = useState(0);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const newSearchQuery = urlParams.get("search") || "";
    const newSelectedCategory = urlParams.get("category") || "";
    const newPage = Math.max(1, parseInt(urlParams.get("page") || "1"));
    
    setSearchQuery(newSearchQuery);
    setSelectedCategory(newSelectedCategory);
    setCurrentPage(newPage);
  }, [location, urlChangeCounter]);

  useEffect(() => {
    const handleUrlChange = (e?: Event) => {
      const urlParams = new URLSearchParams(window.location.search);
      const newSearchQuery = urlParams.get("search") || "";
      const newSelectedCategory = urlParams.get("category") || "";
      const newPage = Math.max(1, parseInt(urlParams.get("page") || "1"));
      
      setSearchQuery(newSearchQuery);
      setSelectedCategory(newSelectedCategory);
      setCurrentPage(newPage);
      setUrlChangeCounter(prev => prev + 1);

      const detail = (e as CustomEvent)?.detail;
      if (detail?.scrollToProducts) {
        setTimeout(() => {
          const el = document.getElementById('products-grid');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('urlchange', handleUrlChange as EventListener);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('urlchange', handleUrlChange as EventListener);
    };
  }, []);
  
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    networkMode: 'offlineFirst',
  });

  const { getCategoryName: getTranslatedCategoryName } = useCategoryTranslations(
    categories.map(c => c.id),
    categories as any
  );

  const getCategoryName = (category: Category | null | undefined) => {
    if (!category) return '';
    return getTranslatedCategoryName(category.id, category.name);
  };

  // Request enough products to cover the current page
  const apiLimit = currentPage * PAGE_SIZE;
  
  const { data: allProducts = [], isLoading, isFetching } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", { 
      search: searchQuery || undefined,
      categorySlug: selectedCategory || undefined,
      limit: apiLimit
    }],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    enabled: true,
  });

  const sortedAll = useMemo(() => {
    if (!allProducts.length) return allProducts;
    const sorted = [...allProducts];
    switch (sortBy) {
      case "price-asc": return sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      case "price-desc": return sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      case "name": return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "rating": return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      default: return sorted;
    }
  }, [allProducts, sortBy]);

  // Paginate client-side
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const products = sortedAll.slice(startIndex, startIndex + PAGE_SIZE);
  const totalFetched = allProducts.length;
  const hasNextPage = totalFetched >= currentPage * PAGE_SIZE;
  const hasPrevPage = currentPage > 1;

  // Build URL for pagination links (preserves category/search params)
  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory) params.set("category", selectedCategory);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  };

  // Build URL for category sidebar links (resets to page 1)
  const buildCategoryUrl = (slug?: string) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (slug) params.set("category", slug);
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newSearch = formData.get("search") as string;
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    if (selectedCategory) params.set("category", selectedCategory);
    navigate(`/products${params.toString() ? `?${params.toString()}` : ""}`);
  };

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

                {/* Categories — crawlable <a> links */}
                <div className="mb-6">
                  <h4 className="font-medium mb-3">{t('nav.categories')}</h4>
                  <nav aria-label="Product categories" className="space-y-1">
                    <Link
                      href={buildCategoryUrl()}
                      onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
                      className={`w-full justify-start inline-flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedCategory === ""
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {t('nav.products')}
                    </Link>
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={buildCategoryUrl(category.slug)}
                        onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
                        className={`w-full justify-start inline-flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                          selectedCategory === category.slug
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {getCategoryName(category)}
                        {selectedCategory === category.slug && isLoading && (
                          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                        )}
                      </Link>
                    ))}
                  </nav>
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
                  {allProducts.length} {t('nav.products').toLowerCase()}
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

            {/* Loading State */}
            {isLoading && !allProducts.length && (
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
            {!isLoading && !isFetching && allProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t('products.noProducts')}</p>
                <Link href="/products">
                  <Button>{t('products.clearFilters')}</Button>
                </Link>
              </div>
            )}

            {/* Products Grid */}
            {products.length > 0 && (
              <>
                <div id="products-grid" className={`grid gap-6 ${
                  viewMode === "grid" 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                    : "grid-cols-1"
                }`}>
                  {products.map((product) => (
                    <ProductCard key={`${product.id}-${selectedCategory}-${searchQuery}-${currentPage}`} product={product} />
                  ))}
                </div>
                
                {/* Crawlable pagination navigation */}
                {(hasPrevPage || hasNextPage) && (
                  <nav aria-label="Product pagination" className="flex items-center justify-center gap-3 mt-8">
                    {hasPrevPage ? (
                      <Link
                        href={buildPageUrl(currentPage - 1)}
                        onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t('products.prevPage') || 'Anterior'}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-4 py-2 rounded-md border border-input bg-background text-sm text-muted-foreground opacity-50 cursor-not-allowed">
                        <ChevronLeft className="h-4 w-4" />
                        {t('products.prevPage') || 'Anterior'}
                      </span>
                    )}

                    <span className="text-sm text-muted-foreground px-2">
                      {t('products.page') || 'Pagina'} {currentPage}
                    </span>

                    {hasNextPage ? (
                      <Link
                        href={buildPageUrl(currentPage + 1)}
                        onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
                        className="inline-flex items-center gap-1 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        rel="next"
                      >
                        {t('products.nextPage') || 'Următor'}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-4 py-2 rounded-md border border-input bg-background text-sm text-muted-foreground opacity-50 cursor-not-allowed">
                        {t('products.nextPage') || 'Următor'}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
