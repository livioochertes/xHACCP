import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, User, Menu, X, Bot, LogOut, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import LanguageSwitcher from "@/components/language-switcher";
import ContactModal from "@/components/contact-modal";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import xhaccpLogo from "@assets/logo_xHACCP-S1_1772812623761.png";

interface CompanySettings {
  freeShippingThreshold?: string;
  defaultCurrency?: string;
}

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const { cart } = useCart();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { t } = useTranslation();

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/admin/api/company-settings"],
  });

  const cartItemCount = cart?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const freeShippingMessage = useMemo(() => {
    const thresholdValue = parseFloat(companySettings?.freeShippingThreshold || "500");
    const currency = companySettings?.defaultCurrency || "RON";
    
    const formattedAmount = new Intl.NumberFormat('ro-RO', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(thresholdValue);
    
    const currencyLabel = currency === "RON" ? "lei" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency;
    
    return `${t('footer.freeShippingPrefix')} ${formattedAmount} ${currencyLabel}`;
  }, [companySettings, t]);

  const categoryIds = Array.isArray(categories) ? categories.map((c: any) => c.id) : [];
  const { getCategoryName: getTranslatedCategoryName } = useCategoryTranslations(categoryIds);

  const getCategoryName = (category: any) => {
    return getTranslatedCategoryName(category.id, category.name);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
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
            <Link href="/ai-assistant">
              <Button variant="ghost" size="sm" className="hidden md:flex">
                <Bot className="h-4 w-4 mr-2" />
                {t('nav.aiAssistant')}
              </Button>
            </Link>
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
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('nav.cart')}</span>
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <div className="flex flex-col space-y-4 mt-4">
                  <form onSubmit={handleSearch} className="flex">
                    <div className="relative w-full">
                      <Input
                        type="text"
                        placeholder={t('search.placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10"
                      />
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    </div>
                  </form>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      console.log("🚀 Mobile All Products button clicked");
                      const startTime = performance.now();
                      const targetUrl = `/products`;
                      console.log("🎯 Navigating to:", targetUrl);
                      navigate(targetUrl);
                      console.log("⏱️ Navigation initiated:", performance.now() - startTime, "ms");
                      console.log("🔗 Current URL after navigation:", window.location.href);
                      
                      // Force a re-render by dispatching a custom event
                      window.dispatchEvent(new CustomEvent('urlchange'));
                    }}
                  >
                    {t('nav.products')}
                  </Button>
                  {categories?.filter(category => category.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder).map((category: any) => (
                    <Button 
                      key={category.id} 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => {
                        console.log("🚀 Mobile category button clicked:", category.name);
                        const startTime = performance.now();
                        const targetUrl = `/products?category=${category.slug}`;
                        console.log("🎯 Navigating to:", targetUrl);
                        navigate(targetUrl);
                        console.log("⏱️ Navigation initiated:", performance.now() - startTime, "ms");
                        console.log("🔗 Current URL after navigation:", window.location.href);
                        
                        // Force a re-render by dispatching a custom event
                        window.dispatchEvent(new CustomEvent('urlchange'));
                      }}
                    >
                      {getCategoryName(category)}
                    </Button>
                  ))}
                  <ContactModal>
                    <Button variant="ghost" className="w-full justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {t('contact.title')}
                    </Button>
                  </ContactModal>
                  <Link href="/ai-assistant">
                    <Button variant="ghost" className="w-full justify-start">
                      <Bot className="h-4 w-4 mr-2" />
                      {t('nav.aiAssistant')}
                    </Button>
                  </Link>
                  {isAuthenticated ? (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => navigate("/account")}
                    >
                      <User className="h-4 w-4 mr-2" />
                      {user?.firstName || t('nav.account')}
                    </Button>
                  ) : !isLoading ? (
                    <Link href="/login">
                      <Button variant="ghost" className="w-full justify-start">
                        <User className="h-4 w-4 mr-2" />
                        {t('nav.login')}
                      </Button>
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
              <Button 
                variant="ghost" 
                className="font-medium"
                onClick={() => {
                  console.log("🚀 All Categories button clicked");
                  const startTime = performance.now();
                  const targetUrl = `/products`;
                  console.log("🎯 Navigating to:", targetUrl);
                  navigate(targetUrl);
                  console.log("⏱️ Navigation initiated:", performance.now() - startTime, "ms");
                  console.log("🔗 Current URL after navigation:", window.location.href);
                  
                  // Force a re-render by dispatching a custom event
                  window.dispatchEvent(new CustomEvent('urlchange'));
                }}
              >
                {t('nav.allCategories')}
              </Button>
              {categories?.filter(category => category.showOnMainTop).sort((a, b) => a.sortOrder - b.sortOrder).map((category: any) => (
                <Button 
                  key={category.id} 
                  variant="ghost" 
                  className="font-medium hidden lg:block" 
                  onClick={() => {
                    console.log("🚀 Category button clicked:", category.name);
                    const startTime = performance.now();
                    const targetUrl = `/products?category=${category.slug}`;
                    console.log("🎯 Navigating to:", targetUrl);
                    navigate(targetUrl);
                    console.log("⏱️ Navigation initiated:", performance.now() - startTime, "ms");
                    console.log("🔗 Current URL after navigation:", window.location.href);
                    
                    // Force a re-render by dispatching a custom event
                    window.dispatchEvent(new CustomEvent('urlchange'));
                  }}
                >
                  {getCategoryName(category)}
                </Button>
              ))}
            </div>
            <div className="hidden lg:flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{t('footer.needHelp')}</span>
              <Link href="/ai-assistant" className="text-sm text-secondary font-medium">
                {t('footer.chat')} Support Chat
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
