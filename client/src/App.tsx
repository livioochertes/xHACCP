import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart-provider";
import { LanguageProvider } from "@/contexts/language-context";
import Header from "@/components/header";
import Home from "@/pages/home";
import Products from "@/pages/products";
import ProductDetails from "@/pages/product-details";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import ThankYou from "@/pages/thank-you";
import Login from "@/pages/login";
import Account from "@/pages/account";
import AIAssistant from "@/pages/ai-assistant";
import About from "@/pages/about";
import B2B from "@/pages/b2b";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Invoice from "@/pages/invoice";
import Blog from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import NotFound from "@/pages/not-found";

function useCanonical() {
  const [location] = useLocation();
  useEffect(() => {
    const canonical = document.getElementById('canonical-url') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = `${window.location.origin}${location === '/' ? '' : location}`;
    }
  }, [location]);
}

function Router() {
  useCanonical();
  return (
    <>
      <Header />
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
        <Route component={NotFound} />
      </Switch>
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
