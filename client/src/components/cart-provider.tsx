import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import type { CartItemWithProduct, CompositeConfiguration } from "@shared/schema";

interface CartContextType {
  cart: CartItemWithProduct[];
  addToCart: (productId: number, quantity: number, compositeConfiguration?: CompositeConfiguration) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const market = getMarketFromHostname();
  const guestCartStorageKey = `guestCart:${market}`;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [localCart, setLocalCart] = useState<CartItemWithProduct[]>([]);

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    
    // Load cart from localStorage for guest users
    if (!token) {
      const savedCart = localStorage.getItem(guestCartStorageKey) ??
        (market === "ro" ? localStorage.getItem("guestCart") : null);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Only keep valid items with product data
          const validItems = parsedCart.filter((item: any) => 
            item.product && item.product.id && item.product.name && item.product.price
          );
          setLocalCart(validItems);
          // Update localStorage with cleaned cart
           localStorage.setItem(guestCartStorageKey, JSON.stringify(validItems));
        } catch (error) {
          console.error("Error parsing guest cart:", error);
           localStorage.removeItem(guestCartStorageKey);
          setLocalCart([]);
        }
      }
    }
  }, []);

  // Load authenticated user's cart from API
  const { data: apiCart, isLoading: apiLoading } = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 0,
  });

  // Use API cart for authenticated users, localStorage cart for guests
  const cart: CartItemWithProduct[] = isAuthenticated ? (apiCart ?? []) : localCart;
  const isLoading = isAuthenticated ? apiLoading : false;

  const addToCartMutation = useMutation<
    { product: any; quantity: number } | Response,
    Error,
    { productId: number; quantity: number; compositeConfiguration?: CompositeConfiguration }
  >({
    mutationFn: async ({ productId, quantity, compositeConfiguration }: { productId: number; quantity: number; compositeConfiguration?: CompositeConfiguration }) => {
      if (isAuthenticated) {
        return apiRequest("POST", "/api/cart", { productId, quantity, compositeConfiguration });
      } else {
        // Guest cart - get product details
        const response = await fetch(`/api/products/${productId}`, {
          headers: { 'X-Market': getMarketFromHostname() }
        });
        const product = await response.json();
        if (product.isComposite && compositeConfiguration) {
          const components = (product.compositeComponents || []) as any[];
          const selectedComponents = compositeConfiguration.components.map(selection => {
            const component = components.find(c => c.id === selection.componentProductId);
            return {
              ...selection,
              name: component?.name,
              productCode: component?.productCode,
              unitPrice: component?.price,
              totalPrice: ((component?.price ? parseFloat(component.price) : 0) * selection.quantity).toFixed(2),
            };
          });
          const totalPrice = selectedComponents.reduce(
            (sum, component) => sum + parseFloat(component.totalPrice || "0"),
            0,
          );
          product.price = totalPrice.toFixed(2);
          return {
            product,
            quantity,
            compositeConfiguration: {
              ...compositeConfiguration,
              components: selectedComponents,
              currency: product.currency,
              totalPrice: product.price,
            },
          };
        }
        return { product, quantity, compositeConfiguration };
      }
    },
    onSuccess: (data, variables) => {
      trackEvent("add_to_cart", {
        product_id: variables.productId,
        quantity: variables.quantity,
        is_composite: Boolean(variables.compositeConfiguration),
        market: getMarketFromHostname(),
      });
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        const guestData = data as { product: any; quantity: number; compositeConfiguration?: CompositeConfiguration };
        // Update guest cart in localStorage
        setLocalCart(prev => {
          const configurationKey = (configuration?: CompositeConfiguration | null) => JSON.stringify(
            (configuration?.components || [])
              .map(component => ({ componentProductId: component.componentProductId, quantity: component.quantity }))
              .sort((a, b) => a.componentProductId - b.componentProductId)
          );
          const existingItem = prev.find(item =>
            item.productId === guestData.product.id &&
            configurationKey(item.compositeConfiguration) === configurationKey(guestData.compositeConfiguration)
          );
          let newCart;
          
          if (existingItem) {
            newCart = prev.map(item =>
              item.id === existingItem.id
                ? { ...item, quantity: item.quantity + guestData.quantity }
                : item
            );
          } else {
            newCart = [...prev, {
              id: Date.now(), // temporary ID
              userId: 0, // guest user
              productId: guestData.product.id,
               market,
              quantity: guestData.quantity,
              compositeConfiguration: guestData.compositeConfiguration || null,
              createdAt: new Date(),
              product: guestData.product
            }];
          }
          
           localStorage.setItem(guestCartStorageKey, JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const updateQuantityMutation = useMutation<
    { itemId: number; quantity: number } | Response,
    Error,
    { itemId: number; quantity: number }
  >({
    mutationFn: async ({ itemId, quantity }: { itemId: number; quantity: number }) => {
      if (isAuthenticated) {
        return apiRequest("PUT", `/api/cart/${itemId}`, { quantity });
      } else {
        return { itemId, quantity };
      }
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        const guestData = data as { itemId: number; quantity: number };
        setLocalCart(prev => {
          const newCart = prev.map(item =>
            item.id === guestData.itemId
              ? { ...item, quantity: guestData.quantity }
              : item
          );
           localStorage.setItem(guestCartStorageKey, JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const removeFromCartMutation = useMutation<
    { itemId: number } | Response,
    Error,
    number
  >({
    mutationFn: async (itemId: number) => {
      if (isAuthenticated) {
        return apiRequest("DELETE", `/api/cart/${itemId}`);
      } else {
        return { itemId };
      }
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        const guestData = data as { itemId: number };
        setLocalCart(prev => {
          const newCart = prev.filter(item => item.id !== guestData.itemId);
           localStorage.setItem(guestCartStorageKey, JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const clearCartMutation = useMutation<Response | Record<string, never>, Error, void>({
    mutationFn: async () => {
      if (isAuthenticated) {
        return apiRequest("DELETE", "/api/cart");
      } else {
        return {};
      }
    },
    onSuccess: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        setLocalCart([]);
         localStorage.removeItem(guestCartStorageKey);
      }
    },
  });

  const addToCart = (productId: number, quantity: number, compositeConfiguration?: CompositeConfiguration) => {
    addToCartMutation.mutate({ productId, quantity, compositeConfiguration });
  };

  const updateQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    updateQuantityMutation.mutate({ itemId, quantity });
  };

  const removeFromCart = (itemId: number) => {
    removeFromCartMutation.mutate(itemId);
  };

  const clearCart = () => {
    clearCartMutation.mutate();
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
