import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import type { CartItemWithProduct } from "@shared/schema";

interface CartContextType {
  cart: CartItemWithProduct[];
  addToCart: (productId: number, quantity: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  removeFromCart: (itemId: number) => void;
  clearCart: () => void;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [localCart, setLocalCart] = useState<CartItemWithProduct[]>([]);

  // Check if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    
    // Load cart from localStorage for guest users
    if (!token) {
      const savedCart = localStorage.getItem("guestCart");
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Only keep valid items with product data
          const validItems = parsedCart.filter((item: any) => 
            item.product && item.product.id && item.product.name && item.product.price
          );
          setLocalCart(validItems);
          // Update localStorage with cleaned cart
          localStorage.setItem("guestCart", JSON.stringify(validItems));
        } catch (error) {
          console.error("Error parsing guest cart:", error);
          localStorage.removeItem("guestCart");
          setLocalCart([]);
        }
      }
    }
  }, []);

  // Load authenticated user's cart from API
  const { data: apiCart = [], isLoading: apiLoading } = useQuery({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 0,
  });

  // Use API cart for authenticated users, localStorage cart for guests
  const cart = isAuthenticated ? apiCart : localCart;
  const isLoading = isAuthenticated ? apiLoading : false;

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      if (isAuthenticated) {
        const token = localStorage.getItem("token");
        return apiRequest("POST", "/api/cart", { productId, quantity }, {
          Authorization: `Bearer ${token}`,
        });
      } else {
        // Guest cart - get product details
        const response = await fetch(`/api/products/${productId}`, {
          headers: { 'X-Market': getMarketFromHostname() }
        });
        const product = await response.json();
        return { product, quantity };
      }
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        // Update guest cart in localStorage
        setLocalCart(prev => {
          const existingItem = prev.find(item => item.productId === data.product.id);
          let newCart;
          
          if (existingItem) {
            newCart = prev.map(item =>
              item.productId === data.product.id
                ? { ...item, quantity: item.quantity + data.quantity }
                : item
            );
          } else {
            newCart = [...prev, {
              id: Date.now(), // temporary ID
              userId: 0, // guest user
              productId: data.product.id,
              quantity: data.quantity,
              createdAt: new Date(),
              product: data.product
            }];
          }
          
          localStorage.setItem("guestCart", JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: number; quantity: number }) => {
      if (isAuthenticated) {
        const token = localStorage.getItem("token");
        return apiRequest("PUT", `/api/cart/${itemId}`, { quantity }, {
          Authorization: `Bearer ${token}`,
        });
      } else {
        return { itemId, quantity };
      }
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        setLocalCart(prev => {
          const newCart = prev.map(item =>
            item.id === data.itemId
              ? { ...item, quantity: data.quantity }
              : item
          );
          localStorage.setItem("guestCart", JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: number) => {
      if (isAuthenticated) {
        const token = localStorage.getItem("token");
        return apiRequest("DELETE", `/api/cart/${itemId}`, undefined, {
          Authorization: `Bearer ${token}`,
        });
      } else {
        return { itemId };
      }
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        setLocalCart(prev => {
          const newCart = prev.filter(item => item.id !== data.itemId);
          localStorage.setItem("guestCart", JSON.stringify(newCart));
          return newCart;
        });
      }
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (isAuthenticated) {
        const token = localStorage.getItem("token");
        return apiRequest("DELETE", "/api/cart", undefined, {
          Authorization: `Bearer ${token}`,
        });
      } else {
        return {};
      }
    },
    onSuccess: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        setLocalCart([]);
        localStorage.removeItem("guestCart");
      }
    },
  });

  const addToCart = (productId: number, quantity: number) => {
    addToCartMutation.mutate({ productId, quantity });
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
