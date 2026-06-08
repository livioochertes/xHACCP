import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Truck, Shield, Award, MessageSquare, Users, Star, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/use-cart";

import ProductCard from "@/components/product-card";
import ContactModal from "@/components/contact-modal";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import type { Category, ProductWithCategory } from "@shared/schema";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface ShippingSettings {
  freeShippingThreshold: string;
  standardShippingCost: string;
  currency: string;
  vatPercentage: string;
}
import xhaccpLogo from "@assets/logo_xHACCP-S1_1772812623761.png";
import suppliesEquipmentImg from "@assets/generated_images/chef_checking_kitchen_inventory.png";
import businessConsultingImg from "@assets/generated_images/business_consulting_meeting_chef.png";
import kitchenManagementImg from "@assets/generated_images/chef_using_tablet_management.png";
import personalizedSupportImg from "@assets/generated_images/support_representative_video_call.png";

export default function Home() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { clearCart } = useCart();
  const { contact } = useCompanySettings();
  const [, setLocation] = useLocation();

  const [vivaConfirmedOrder, setVivaConfirmedOrder] = useState<{
    orderId?: number | null;
    subtotal: number;
    discountAmount: number;
    voucherCode: string | null;
    shipping: number;
    total: number;
    currencySymbol: string;
  } | null>(null);
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: featuredProducts = [] } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", { featured: true, limit: 20 }],
  });

  const { data: shippingSettings } = useQuery<ShippingSettings>({
    queryKey: ["/api/shipping-settings"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success') {
      clearCart();
      const stored = localStorage.getItem('xhaccp_pending_order_summary');
      if (stored) {
        try {
          setVivaConfirmedOrder(JSON.parse(stored));
        } catch (_) {}
        localStorage.removeItem('xhaccp_pending_order_summary');
      } else {
        toast({
          title: t('checkout.orderSuccess'),
          description: t('checkout.orderSuccessDesc'),
        });
      }
      window.history.replaceState({}, '', '/');
    } else if (paymentStatus === 'failed') {
      toast({
        title: t('checkout.paymentFailed'),
        description: t('checkout.orderFailedDesc'),
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/');
    } else if (paymentStatus === 'error') {
      toast({
        title: t('checkout.paymentFailed'),
        description: t('checkout.orderFailedDesc'),
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'RON': return 'lei';
      default: return curr;
    }
  };

  const formatThreshold = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString('ro-RO', { maximumFractionDigits: 0 });
    const symbol = getCurrencySymbol(currency);
    if (currency === 'RON') {
      return `${formatted} ${symbol}`;
    }
    return `${symbol}${formatted}`;
  };

  const shippingThresholdText = shippingSettings
    ? formatThreshold(shippingSettings.freeShippingThreshold, shippingSettings.currency)
    : '';

  // Carousel setup for featured products with autoplay
  const autoplayRef = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true, 
    align: 'start',
    slidesToScroll: 1
  }, [autoplayRef.current]);
  
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const { getCategoryName: getTranslatedCategoryName, getCategoryDescription: getTranslatedCategoryDescription } = useCategoryTranslations(
    categories.map(c => c.id),
    categories as any
  );

  const getCategoryName = (category: Category) => {
    return getTranslatedCategoryName(category.id, category.name);
  };

  const getCategoryDescription = (category: Category) => {
    return getTranslatedCategoryDescription(category.id, category.description);
  };

  const trustIndicators = [
    { icon: Truck, text: t('home.features.shipping').replace('{threshold}', shippingThresholdText) },
    { icon: Shield, text: t('home.features.compliant') },
    { icon: Award, text: t('home.features.certified') },
    { icon: MessageSquare, text: t('home.features.support') },
    { icon: Users, text: t('home.features.customers') },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Restaurant Manager",
      rating: 5,
      comment: "Excellent quality labels and fast shipping. Our restaurant has been using xHACCP for over 2 years now. Highly recommended!",
    },
    {
      name: "Mike Chen",
      role: "Food Service Director",
      rating: 5,
      comment: "The B2B pricing has saved us hundreds of dollars. Great customer service and the products are exactly what we need for compliance.",
    },
    {
      name: "Lisa Rodriguez",
      role: "Cafe Owner",
      rating: 5,
      comment: "Professional quality equipment at competitive prices. The HACCP compliance kit was exactly what our cafe needed for inspection.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Viva payment order confirmation banner */}
      {vivaConfirmedOrder && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="container mx-auto px-4 py-6">
            <Card className="max-w-lg mx-auto">
              <CardContent className="pt-6 pb-6 text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">{t('checkout.orderSuccess')}</h2>
                  <p className="text-muted-foreground text-sm">{t('checkout.orderSuccessDesc')}</p>
                  {vivaConfirmedOrder.orderId && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                      <span className="text-green-600">#</span>{vivaConfirmedOrder.orderId}
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold text-sm mb-3">{t('checkout.orderSummary')}</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('checkout.subtotal')}:</span>
                    <span>{vivaConfirmedOrder.subtotal.toFixed(2)} {vivaConfirmedOrder.currencySymbol}</span>
                  </div>
                  {vivaConfirmedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t('checkout.voucher')} {vivaConfirmedOrder.voucherCode ? `(${vivaConfirmedOrder.voucherCode})` : ''}:</span>
                      <span>-{vivaConfirmedOrder.discountAmount.toFixed(2)} {vivaConfirmedOrder.currencySymbol}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('checkout.shipping')}:</span>
                    <span>
                      {vivaConfirmedOrder.shipping === 0
                        ? <Badge variant="secondary">{t('checkout.freeShipping')}</Badge>
                        : `${vivaConfirmedOrder.shipping.toFixed(2)} ${vivaConfirmedOrder.currencySymbol}`}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>{t('checkout.total')}:</span>
                    <span>{vivaConfirmedOrder.total.toFixed(2)} {vivaConfirmedOrder.currencySymbol}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setVivaConfirmedOrder(null)}>
                  ✕ {t('checkout.backToShop')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="hero-gradient text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t('home.hero.title')}
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              {t('home.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <Button size="lg" className="kitchen-pro-secondary">
                  {t('home.hero.shopNow')}
                </Button>
              </Link>
              <ContactModal>
                <Button size="lg" variant="outline" className="border-white text-white bg-white/10 hover:bg-white hover:text-primary">
                  {t('home.hero.quote')}
                </Button>
              </ContactModal>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8 text-center">
            {trustIndicators.map((indicator, index) => (
              <div key={index} className="trust-indicator">
                <indicator.icon className="h-5 w-5" />
                <span className="text-sm text-slate-600">{indicator.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Categories */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">{t('home.categories.title')}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {t('home.categories.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.filter(category => category.showOnMainShop).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((category) => (
              <Card key={category.id} className="category-card group cursor-pointer">
                <Link href={`/products?category=${category.slug}`}>
                  <CardContent className="p-0">
                    <div className="relative overflow-hidden">
                      <img
                        src={category.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=300"}
                        alt={category.name}
                        className="category-image w-full h-48 object-cover"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-primary mb-2">{getCategoryName(category)}</h3>
                      <p className="text-slate-600 mb-4">{getCategoryDescription(category)}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">{(category as any).productCount || 0} {t('home.categories.products')}</span>
                        <Button variant="ghost" className="text-secondary hover:text-blue-600 p-0">
                          {t('home.categories.viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">{t('home.products.title')}</h2>
            <p className="text-slate-600">{t('home.products.subtitle')}</p>
          </div>

          {featuredProducts.length > 0 && (
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={scrollPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-100 transition-colors border border-gray-200"
                style={{ marginLeft: '-20px' }}
                data-testid="carousel-prev-button"
              >
                <ChevronLeft className="h-6 w-6 text-primary" />
              </button>

              {/* Carousel */}
              <div className="overflow-hidden mx-8" ref={emblaRef}>
                <div className="flex gap-6">
                  {featuredProducts.map((product) => (
                    <div 
                      key={product.id} 
                      className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]"
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Arrow */}
              <button
                onClick={scrollNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-3 hover:bg-gray-100 transition-colors border border-gray-200"
                style={{ marginRight: '-20px' }}
                data-testid="carousel-next-button"
              >
                <ChevronRight className="h-6 w-6 text-primary" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* B2B Section */}
      <section className="py-16 bg-slate-100">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-primary mb-6">{t('home.business.title')}</h2>
                <p className="text-slate-600 mb-8">
                  {t('home.business.description')}
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    t('home.business.suppliesEquipment'),
                    t('home.business.businessConsulting'),
                    t('home.business.kitchenManagement'),
                    t('home.business.personalizedSupport'),
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="w-5 h-5 rounded-full kitchen-pro-accent flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <ContactModal>
                    <Button className="kitchen-pro-secondary">
                      {t('home.business.getQuote')}
                    </Button>
                  </ContactModal>
                  <Link href="/ai-assistant">
                    <Button variant="outline" className="border-secondary text-secondary hover:bg-secondary hover:text-white">
                      {t('home.business.contactSales')}
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative rounded-lg overflow-hidden shadow-md group">
                  <img
                    src={suppliesEquipmentImg}
                    alt="Supplies & Equipment"
                    className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                    <span className="text-white font-semibold text-lg p-4">{t('home.business.suppliesEquipment')}</span>
                  </div>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-md group">
                  <img
                    src={businessConsultingImg}
                    alt="Business Consulting"
                    className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                    <span className="text-white font-semibold text-lg p-4">{t('home.business.businessConsulting')}</span>
                  </div>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-md group">
                  <img
                    src={kitchenManagementImg}
                    alt="Kitchen Management"
                    className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                    <span className="text-white font-semibold text-lg p-4">{t('home.business.kitchenManagement')}</span>
                  </div>
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-md group">
                  <img
                    src={personalizedSupportImg}
                    alt="Personalized Support"
                    className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                    <span className="text-white font-semibold text-lg p-4">{t('home.business.personalizedSupport')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary mb-4">{t('home.testimonials.title')}</h2>
            <p className="text-slate-600">{t('home.testimonials.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="kitchen-pro-muted">
                <CardContent className="p-6">
                  <div className="flex text-yellow-400 mb-4">
                    {Array.from({ length: testimonial.rating }, (_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-700 mb-4">{testimonial.comment}</p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center">
                      <span className="text-slate-600 font-semibold">
                        {testimonial.name.split(" ").map(n => n[0]).join("")}
                      </span>
                    </div>
                    <div className="ml-4">
                      <h4 className="font-semibold text-primary">{testimonial.name}</h4>
                      <p className="text-sm text-slate-500">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 kitchen-pro-secondary">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">{t('home.newsletter.title')}</h2>
            <p className="text-blue-100 mb-8">
              {t('home.newsletter.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder={t('home.newsletter.placeholder')}
                className="flex-1 bg-white"
              />
              <Button className="bg-white text-secondary hover:bg-slate-100">
                {t('home.newsletter.subscribe')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="kitchen-pro-primary py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-16 h-16 bg-white rounded-lg p-1 flex items-center justify-center">
                  <img 
                    src={xhaccpLogo} 
                    alt="xHACCP Logo" 
                    className="w-14 h-14 object-contain"
                  />
                </div>
              </div>
              <p className="text-slate-300 mb-4">
                {t('footer.company.description')}
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-300 hover:text-white transition-colors">
                  <i className="fab fa-facebook"></i>
                </a>
                <a href="#" className="text-slate-300 hover:text-white transition-colors">
                  <i className="fab fa-twitter"></i>
                </a>
                <a href="#" className="text-slate-300 hover:text-white transition-colors">
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="#" className="text-slate-300 hover:text-white transition-colors">
                  <i className="fab fa-linkedin"></i>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('footer.quickLinks')}</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-slate-300 hover:text-white transition-colors">{t('footer.aboutUs')}</Link></li>
                <li><Link href="/products" className="text-slate-300 hover:text-white transition-colors">{t('footer.products')}</Link></li>
                <li><Link href="/b2b" className="text-slate-300 hover:text-white transition-colors">{t('footer.b2bSolutions')}</Link></li>
                <li><Link href="/blog" className="text-slate-300 hover:text-white transition-colors">Blog</Link></li>
                <li>
                  <ContactModal>
                    <button className="text-slate-300 hover:text-white transition-colors">
                      {t('footer.contact')}
                    </button>
                  </ContactModal>
                </li>
                <li>
                  <Link href="/ai-assistant" className="text-slate-300 hover:text-white transition-colors">
                    {t('footer.support')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('footer.categories')}</h3>
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/products?category=${category.slug}`} className="text-slate-300 hover:text-white transition-colors">
                      {getCategoryName(category)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">{t('footer.support')}</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <MessageSquare className="h-5 w-5 text-secondary" />
                  <Link href="/ai-assistant" className="text-white hover:text-secondary transition-colors font-medium">
                    {t('footer.needHelp')} {t('footer.chat')}
                  </Link>
                </div>
                {contact.email && (
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-envelope text-secondary"></i>
                    <a href={`mailto:${contact.email}`} className="text-slate-300 hover:text-white transition-colors">{contact.email}</a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-phone text-secondary"></i>
                    <a href={`tel:${contact.phone}`} className="text-slate-300 hover:text-white transition-colors">{contact.phone}</a>
                  </div>
                )}
                {(contact.address || contact.city) && (
                  <div className="flex items-start space-x-2">
                    <i className="fas fa-map-marker-alt text-secondary mt-1"></i>
                    <div className="text-slate-300">
                      {contact.address && <div>{contact.address}</div>}
                      {(contact.zipCode || contact.city || contact.country) && (
                        <div>{[contact.zipCode, contact.city, contact.country].filter(Boolean).join(', ')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 mt-8 pt-8 text-center">
            <p className="text-slate-300">
              &copy; 2025 xHACCP. All rights reserved. | 
              <Link href="/privacy" className="hover:text-white ml-2">Privacy Policy</Link> | 
              <Link href="/terms" className="hover:text-white ml-2">Terms & Conditions</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
