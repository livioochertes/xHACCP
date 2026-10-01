import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Menu, X, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import LanguageSwitcher from "@/components/language-switcher";
import ContactModal from "@/components/contact-modal";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import xhaccpLogo from "@assets/logo_xHACCP-S1_1772812623761.png";

interface ShippingSettings {
  freeShippingThreshold: string;
  currency: string;
}

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileContactOpen, setMobileContactOpen] = useState(false);
  const [, navigate] = useLocation();
  const { cart } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useTranslation();

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const { data: shippingSettings } = useQuery<ShippingSettings>({
    queryKey: ["/api/shipping-settings"],
  });

  const cartItemCount = cart?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const freeShippingMessage = useMemo(() => {
    const thresholdValue = parseFloat(shippingSettings?.freeShippingThreshold || "500");
    const currency = shippingSettings?.currency || "RON";
    
    const formattedAmount = new Intl.NumberFormat('ro-RO', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(thresholdValue);
    
    const currencyLabel = currency === "RON" ? "lei" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency;
    
    return `${t('footer.freeShippingPrefix')} ${formattedAmount} ${currencyLabel}`;
  }, [shippingSettings, t]);

  const categoryIds = Array.isArray(categories) ? categories.map((c: any) => c.id) : [];
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const { getCategoryName: getTranslatedCategoryName } = useCategoryTranslations(categoryIds, categoriesArray as any);

  const getCategoryName = (category: any) => {
    return getTranslatedCategoryName(category.id, category.name);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    trackEvent("search_submitted", {
      query_length: query.length,
      location: "header",
      market: getMarketFromHostname(),
    });
    navigate(`/products?search=${encodeURIComponent(query)}`);
  };

  const closeMobileAndDispatch = (href?: string) => {
    setMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('urlchange', { detail: { scrollToProducts: true } }));
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Top Banner */}
      <div className="kitchen-pro-primary py-2">
        <div className="container mx-auto px-4 text-center text-sm">
          <span>{freeShippingMessage} • {t('footer.professionalSupport')}</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 flex-shrink-0">
            <img 
              src={xhaccpLogo} 
              alt="xHACCP Logo" 
              className="w-[100px] h-[100px] object-contain -my-4"
            />
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <Input
                type="text"
                placeholder={t('search.placeholder')}
                aria-label={t('search.label')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>
          </form>

          {/* Header Actions */}
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <ContactModal 
              triggerText={t('contact.title')} 
              triggerVariant="ghost" 
              triggerSize="sm"
              triggerIcon={<MessageSquare className="h-4 w-4 mr-2" />}
            >
              <Button variant="ghost" size="sm" className="hidden md:flex">
                <MessageSquare className="h-4 w-4 mr-2" />
                {t('contact.title')}
              </Button>
            </ContactModal>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex">
                    <User className="h-4 w-4 mr-2" />
                    {user?.firstName || "Account"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <User className="h-4 w-4 mr-2" />
                    {t('nav.account')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !isLoading ? (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden md:flex">
                  <User className="h-4 w-4 mr-2" />
                  {t('nav.login')}
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="hidden md:flex" disabled>
                <User className="h-4 w-4 mr-2" />
                {user?.firstName || t('nav.login')}
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="relative">
              <Link href="/cart" aria-label={t('nav.cart')}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('nav.cart')}</span>
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cartItemCount}
                  </Badge>
                )}
              </Link>
            </Button>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden" aria-label={t('nav.openMenu')}>
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" aria-describedby={undefined}>
                <SheetTitle className="sr-only">{t('nav.mainNavigation')}</SheetTitle>
                <div className="flex flex-col space-y-4 mt-4">
                  <form onSubmit={handleSearch} className="flex">
                    <div className="relative w-full">
                      <Input
                        type="text"
                        placeholder={t('search.placeholder')}
                        aria-label={t('search.label')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10"
                      />
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </form>
                  <Link
                    href="/products"
                    className="w-full justify-start inline-flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => closeMobileAndDispatch()}
                  >
                    {t('nav.products')}
                  </Link>
                  {categories?.filter((category: any) => category.showOnMainTop).sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((category: any) => (
                    <Link
                      key={category.id}
                      href={`/products?category=${category.slug}`}
                      className="w-full justify-start inline-flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => closeMobileAndDispatch()}
                    >
                      {getCategoryName(category)}
                    </Link>
                  ))}
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setTimeout(() => setMobileContactOpen(true), 200);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t('contact.title')}
                  </Button>
                  {isAuthenticated ? (
                    <Link
                      href="/account"
                      className="w-full justify-start inline-flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      {user?.firstName || t('nav.account')}
                    </Link>
                  ) : !isLoading ? (
                    <Link
                      href="/login"
                      className="w-full justify-start inline-flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      {t('nav.login')}
                    </Link>
                  ) : (
                    <Button variant="ghost" className="w-full justify-start" disabled>
                      <User className="h-4 w-4 mr-2" />
                      {user?.firstName || t('nav.login')}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="kitchen-pro-muted py-3">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link
                href="/products"
                className="font-medium inline-flex items-center px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
              >
                {t('nav.allCategories')}
              </Link>
              {categories?.filter((category: any) => category.showOnMainTop).sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((category: any) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  className="font-medium hidden lg:inline-flex items-center px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('urlchange'))}
                >
                  {getCategoryName(category)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <ContactModal open={mobileContactOpen} onOpenChange={setMobileContactOpen} />
    </header>
  );
}
