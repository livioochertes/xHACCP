import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart-provider";
import { LanguageProvider } from "@/contexts/language-context";
import Header from "@/components/header";
import AiChatWidget from "@/components/ai-chat-widget";
const Home = lazy(() => import("@/pages/home"));
const Products = lazy(() => import("@/pages/products"));
const ProductDetails = lazy(() => import("@/pages/product-details"));
const Cart = lazy(() => import("@/pages/cart"));
const Checkout = lazy(() => import("@/pages/checkout"));
const ThankYou = lazy(() => import("@/pages/thank-you"));
const Login = lazy(() => import("@/pages/login"));
const Account = lazy(() => import("@/pages/account"));
const AIAssistant = lazy(() => import("@/pages/ai-assistant"));
const About = lazy(() => import("@/pages/about"));
const B2B = lazy(() => import("@/pages/b2b"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Invoice = lazy(() => import("@/pages/invoice"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const ChefEvent = lazy(() => import("@/pages/chef-event"));
const NotFound = lazy(() => import("@/pages/not-found"));

function useCanonical() {
  const [location] = useLocation();
  useEffect(() => {
    const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
    if (canonical) {
      const url = new URL(window.location.href);
      url.hostname = url.hostname.replace(/^www\./, "");
      url.pathname = location;
      url.hash = "";
      canonical.href = url.toString();
    }
  }, [location]);
}

function PublicPageMounted() {
  const [location] = useLocation();
  useEffect(() => {
    // Data-backed pages keep the public HTML until their request settles.
    if (!/^\/(products|blog)(\/[^/]+)?$/.test(location)) {
      window.dispatchEvent(new Event("public-page-ready"));
    }
  }, [location]);
  return null;
}

function Router() {
  useCanonical();
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center bg-slate-50">
            <div className="loading-spinner" aria-label="Loading page" />
          </div>
        }
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/products/:slug" component={ProductDetails} />
          <Route path="/cart" component={Cart} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/merci" component={ThankYou} />
          <Route path="/login" component={Login} />
          <Route path="/account" component={Account} />
          <Route path="/ai-assistant" component={AIAssistant} />
          <Route path="/about" component={About} />
          <Route path="/b2b" component={B2B} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/invoice/:invoiceId" component={Invoice} />
          <Route path="/blog" component={Blog} />
          <Route path="/blog/:slug" component={BlogPostPage} />
          <Route path="/chef-event" component={ChefEvent} />
          <Route component={NotFound} />
        </Switch>
        <PublicPageMounted />
      </Suspense>
      <AiChatWidget />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
