import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Package, Users, ShoppingCart, DollarSign, Search, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/header";
import type { Category, ProductWithCategory, OrderWithItems, Supplier } from "@shared/schema";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  compareAtPrice: z.string().optional(),
  categoryId: z.number().min(1, "Category is required"),
  supplierId: z.number().optional(),
  imageUrl: z.string().refine((val) => !val || val.startsWith("/") || val.startsWith("http"), "Must be a valid URL or path").optional(),
  inStock: z.boolean().default(true),
  stockQuantity: z.number().min(0, "Stock quantity must be positive"),
  featured: z.boolean().default(false),
  priority: z.number().min(0, "Priority must be 0 or higher").default(0),
});

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().refine((val) => !val || val.startsWith("/") || val.startsWith("http"), "Must be a valid URL or path").optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type CategoryFormData = z.infer<typeof categorySchema>;

export default function Admin() {
  const [highlightOrderId, setHighlightOrderId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const orderMatch = hash.match(/^orders-(\d+)$/);
    if (orderMatch) return 'orders';
    const validTabs = ['dashboard', 'products', 'categories', 'orders'];
    return validTabs.includes(hash) ? hash : 'dashboard';
  });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useAuth();
  const [, navigate] = useLocation();

  // Check if user is admin
  useEffect(() => {
    if (!userLoading && (!user || !user.isAdmin)) {
      navigate("/login?redirect=/admin");
    }
  }, [user, userLoading, navigate]);

  // Show loading while checking auth
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (!user || !user.isAdmin) {
    return null;
  }

  // Queries
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<ProductWithCategory[]>({
    queryKey: ["/api/products", { limit: 100 }],
  });

  console.log("🔍 Products query status:", { 
    productsLoading, 
    productsError, 
    productsCount: products.length,
    user: user?.email,
    isAdmin: user?.isAdmin 
  });

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    console.log("🔍 Filtering products:", { 
      totalProducts: products.length, 
      searchQuery, 
      categoryFilter, 
      statusFilter, 
      stockFilter 
    });
    
    let filtered = products.filter(product => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower) ||
          product.category?.name.toLowerCase().includes(searchLower) ||
          product.id.toString().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Category filter
      if (categoryFilter !== "all") {
        if (product.categoryId !== parseInt(categoryFilter)) return false;
      }
      
      // Status filter
      if (statusFilter !== "all") {
        if ((product.status || "active") !== statusFilter) return false;
      }
      
      // Stock filter
      if (stockFilter !== "all") {
        const stock = product.stockQuantity || 0;
        if (stockFilter === "in-stock" && stock <= 0) return false;
        if (stockFilter === "low-stock" && stock >= 10) return false;
        if (stockFilter === "out-of-stock" && stock > 0) return false;
      }
      
      return true;
    });
    
    // Sort filtered products
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "price":
          aValue = parseFloat(a.price);
          bValue = parseFloat(b.price);
          break;
        case "category":
          aValue = a.category?.name.toLowerCase() || "";
          bValue = b.category?.name.toLowerCase() || "";
          break;
        case "stock":
          aValue = a.stockQuantity || 0;
          bValue = b.stockQuantity || 0;
          break;
        case "status":
          aValue = a.status || "active";
          bValue = b.status || "active";
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    console.log("🎯 Filter results:", { 
      filteredCount: filtered.length, 
      totalCount: products.length 
    });
    
    return filtered;
  }, [products, searchQuery, categoryFilter, statusFilter, stockFilter, sortBy, sortOrder]);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/admin/api/suppliers"],
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
  });

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const orderMatch = hash.match(/^orders-(\d+)$/);
    if (orderMatch && !ordersLoading && orders.length > 0) {
      const orderId = parseInt(orderMatch[1], 10);
      setHighlightOrderId(orderId);
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(`order-row-${orderId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
      setTimeout(() => setHighlightOrderId(null), 6000);
    }
  }, [orders, ordersLoading]);

  // Forms
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      price: "",
      compareAtPrice: "",
      categoryId: 0,
      supplierId: undefined,
      imageUrl: "",
      inStock: true,
      stockQuantity: 0,
      featured: false,
    },
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      productForm.reset();
      toast({ title: "Product created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductFormData> }) => {
      return await apiRequest("PUT", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
      productForm.reset();
      toast({ title: "Product updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/products/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      categoryForm.reset();
      toast({ title: "Category created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PUT", `/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update order status", variant: "destructive" });
    },
  });

  // Bulk Operations Mutations
  const bulkUpdatePricesMutation = useMutation({
    mutationFn: async ({ productIds, multiplier, fixedPrice }: { productIds: number[]; multiplier?: number; fixedPrice?: string }) => {
      return await apiRequest("PUT", "/admin/api/products/bulk/prices", { productIds, multiplier, fixedPrice });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      setBulkDialogOpen(false);
      toast({ title: "Prices updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update prices", variant: "destructive" });
    },
  });

  const bulkUpdateCategoriesMutation = useMutation({
    mutationFn: async ({ productIds, categoryId }: { productIds: number[]; categoryId: number }) => {
      return await apiRequest("PUT", "/admin/api/products/bulk/categories", { productIds, categoryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      setBulkDialogOpen(false);
      toast({ title: "Categories updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update categories", variant: "destructive" });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ productIds, status }: { productIds: number[]; status: string }) => {
      return await apiRequest("PUT", "/admin/api/products/bulk/status", { productIds, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      setBulkDialogOpen(false);
      toast({ title: "Status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const bulkUpdateStockMutation = useMutation({
    mutationFn: async ({ productIds, operation, value }: { productIds: number[]; operation: string; value: number }) => {
      return await apiRequest("PUT", "/admin/api/products/bulk/stock", { productIds, operation, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      setBulkDialogOpen(false);
      toast({ title: "Stock updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update stock", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ productIds }: { productIds: number[] }) => {
      return await apiRequest("PUT", "/admin/api/products/bulk/delete", { productIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedProducts([]);
      setBulkDialogOpen(false);
      toast({ title: "Products deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete products", variant: "destructive" });
    },
  });

  // Handlers
  const handleEditProduct = (product: ProductWithCategory) => {
    setEditingProduct(product);
    productForm.reset({
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      price: product.price,
      compareAtPrice: product.compareAtPrice || "",
      categoryId: product.categoryId || 0,
      supplierId: product.supplierId || undefined,
      imageUrl: product.imageUrl || "",
      inStock: product.inStock || false,
      stockQuantity: product.stockQuantity || 0,
      featured: product.featured || false,
      priority: product.priority || 0,
    });
    setProductDialogOpen(true);
  };

  const handleProductSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleCategorySubmit = (data: CategoryFormData) => {
    createCategoryMutation.mutate(data);
  };

  const handleDeleteProduct = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleUpdateOrderStatus = (orderId: number, status: string) => {
    updateOrderStatusMutation.mutate({ id: orderId, status });
  };

  // Bulk Operations Handlers
  const handleSelectProduct = (productId: number) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkOperation = (operation: string) => {
    if (selectedProducts.length === 0) {
      toast({ title: "No products selected", variant: "destructive" });
      return;
    }
    setBulkOperation(operation);
    setBulkDialogOpen(true);
  };

  const handleBulkSubmit = (formData: any) => {
    const productIds = selectedProducts;
    
    switch (bulkOperation) {
      case 'prices':
        bulkUpdatePricesMutation.mutate({ 
          productIds, 
          multiplier: formData.multiplier, 
          fixedPrice: formData.fixedPrice 
        });
        break;
      case 'categories':
        bulkUpdateCategoriesMutation.mutate({ 
          productIds, 
          categoryId: formData.categoryId 
        });
        break;
      case 'status':
        bulkUpdateStatusMutation.mutate({ 
          productIds, 
          status: formData.status 
        });
        break;
      case 'stock':
        bulkUpdateStockMutation.mutate({ 
          productIds, 
          operation: formData.operation, 
          value: formData.value 
        });
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${productIds.length} products?`)) {
          bulkDeleteMutation.mutate({ productIds });
        }
        break;
      default:
        toast({ title: "Unknown operation", variant: "destructive" });
    }
  };

  // Statistics
  const totalProducts = products.length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
  const pendingOrders = orders.filter(order => order.status === "pending").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
          <Badge variant="secondary">Administrator</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    Active products in catalog
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {pendingOrders} pending orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    All-time revenue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Categories</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{categories.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Product categories
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Order #{order.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt || "").toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${parseFloat(order.totalAmount).toFixed(2)}</p>
                          <Badge variant={order.status === "pending" ? "secondary" : "default"}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Low Stock Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {products
                      .filter(product => (product.stockQuantity || 0) < 10)
                      .slice(0, 5)
                      .map((product) => (
                        <div key={product.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.category?.name}
                            </p>
                          </div>
                          <Badge variant="destructive">
                            {product.stockQuantity || 0} left
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            {/* Search and Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filter Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, category, description, product code, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="kitchen-pro-secondary" onClick={() => {
                        setEditingProduct(null);
                        productForm.reset({
                          name: "",
                          slug: "",
                          description: "",
                          price: "",
                          compareAtPrice: "",
                          categoryId: 0,
                          supplierId: undefined,
                          imageUrl: "",
                          inStock: true,
                          stockQuantity: 0,
                          featured: false,
                          priority: 0,
                        });
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editingProduct ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                      </DialogHeader>
                      <Form {...productForm}>
                        <form onSubmit={productForm.handleSubmit(handleProductSubmit)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={productForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Product Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="slug"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Slug</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={productForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={productForm.control}
                              name="price"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Price</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="compareAtPrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Compare At Price</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={productForm.control}
                              name="categoryId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                          {category.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="supplierId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Supplier</FormLabel>
                                  <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a supplier" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="">No Supplier</SelectItem>
                                      {suppliers.map((supplier) => (
                                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                          {supplier.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={productForm.control}
                              name="stockQuantity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stock Quantity</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={productForm.control}
                            name="imageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Image URL</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex items-center space-x-4">
                            <FormField
                              control={productForm.control}
                              name="inStock"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel>In Stock</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={productForm.control}
                              name="featured"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel>Featured</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={productForm.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Prioritate afișare</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0"
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <p className="text-sm text-muted-foreground">
                                  1 = prioritate maximă (afișat primul), 2, 3 = priorități mai mici, 0 = ordine implicită
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" className="kitchen-pro-secondary">
                              {editingProduct ? "Update" : "Create"} Product
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-filter">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger id="category-filter">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="stock-filter">Stock Status</Label>
                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger id="stock-filter">
                        <SelectValue placeholder="All Stock" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stock</SelectItem>
                        <SelectItem value="in-stock">In Stock</SelectItem>
                        <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                        <SelectItem value="low-stock">Low Stock (&lt;10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sort-by">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger id="sort-by">
                        <SelectValue placeholder="Sort By" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sort-order">Order</Label>
                    <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
                      <SelectTrigger id="sort-order">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Filter Summary */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredProducts.length} of {products.length} products
                  </span>
                  {(searchQuery || categoryFilter !== "all" || statusFilter !== "all" || stockFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("all");
                        setStatusFilter("all");
                        setStockFilter("all");
                      }}
                      className="h-7"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Products Table */}
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts(filteredProducts.map(p => p.id));
                            } else {
                              setSelectedProducts([]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative w-12 h-12">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-500">No Image</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category?.name || 'No Category'}</TableCell>
                        <TableCell>${parseFloat(product.price).toFixed(2)}</TableCell>
                        <TableCell>{product.stockQuantity}</TableCell>
                        <TableCell>
                          <Badge variant={
                            product.status === "active" ? "default" :
                            product.status === "inactive" ? "secondary" :
                            product.status === "draft" ? "outline" :
                            "destructive"
                          }>
                            {product.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {/* Bulk Operations */}
            {selectedProducts.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProducts([])}
                      className="text-blue-600 border-blue-300 hover:bg-blue-100"
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkOperation('prices')}
                      className="text-green-600 border-green-300 hover:bg-green-100"
                    >
                      Update Prices
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkOperation('categories')}
                      className="text-purple-600 border-purple-300 hover:bg-purple-100"
                    >
                      Change Category
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkOperation('status')}
                      className="text-yellow-600 border-yellow-300 hover:bg-yellow-100"
                    >
                      Update Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkOperation('stock')}
                      className="text-blue-600 border-blue-300 hover:bg-blue-100"
                    >
                      Update Stock
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkOperation('delete')}
                      className="text-red-600 border-red-300 hover:bg-red-100"
                    >
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="kitchen-pro-secondary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Category</DialogTitle>
                  </DialogHeader>
                  <Form {...categoryForm}>
                    <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                      <FormField
                        control={categoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={categoryForm.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={categoryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={categoryForm.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="kitchen-pro-secondary">
                          Create Category
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <Card key={category.id}>
                  <CardContent className="p-0">
                    <img
                      src={category.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=200"}
                      alt={category.name}
                      className="w-full h-40 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        {category.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {products.filter(p => p.categoryId === category.id).length} products
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        id={`order-row-${order.id}`}
                        className={highlightOrderId === order.id ? 'bg-yellow-100 dark:bg-yellow-900/30 transition-colors duration-1000' : ''}
                      >
                        <TableCell>#{order.id}</TableCell>
                        <TableCell>
                          {new Date(order.createdAt || "").toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {typeof order.shippingAddress === 'object' && order.shippingAddress
                                ? `${(order.shippingAddress as any).firstName || ''} ${(order.shippingAddress as any).lastName || ''}`.trim() || "N/A"
                                : "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.items?.length || 0} items
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>${parseFloat(order.totalAmount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(status) => handleUpdateOrderStatus(order.id, status)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bulk Operations Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Operations</DialogTitle>
            </DialogHeader>
            <BulkOperationsForm
              operation={bulkOperation}
              onSubmit={handleBulkSubmit}
              onCancel={() => setBulkDialogOpen(false)}
              categories={categories}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Bulk Operations Form Component
function BulkOperationsForm({ operation, onSubmit, onCancel, categories }: {
  operation: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  categories: Category[];
}) {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderForm = () => {
    switch (operation) {
      case 'prices':
        return (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Price Update Method</label>
                <select
                  className="w-full mt-1 p-2 border rounded-md"
                  value={formData.method || 'multiplier'}
                  onChange={(e) => setFormData({...formData, method: e.target.value})}
                >
                  <option value="multiplier">Multiply by factor</option>
                  <option value="fixed">Set fixed price</option>
                </select>
              </div>
              {formData.method === 'multiplier' ? (
                <div>
                  <label className="text-sm font-medium">Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full mt-1 p-2 border rounded-md"
                    value={formData.multiplier || ''}
                    onChange={(e) => setFormData({...formData, multiplier: parseFloat(e.target.value)})}
                    placeholder="e.g., 1.1 for 10% increase"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Fixed Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full mt-1 p-2 border rounded-md"
                    value={formData.fixedPrice || ''}
                    onChange={(e) => setFormData({...formData, fixedPrice: e.target.value})}
                    placeholder="e.g., 29.99"
                  />
                </div>
              )}
            </div>
          </>
        );
      case 'categories':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Category</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={formData.categoryId || ''}
                onChange={(e) => setFormData({...formData, categoryId: parseInt(e.target.value)})}
              >
                <option value="">Choose a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      case 'status':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Product Status</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={formData.status || 'active'}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
          </div>
        );
      case 'stock':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Stock Update Method</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={formData.operation || 'set'}
                onChange={(e) => setFormData({...formData, operation: e.target.value})}
              >
                <option value="set">Set stock level</option>
                <option value="add">Add to stock</option>
                <option value="subtract">Subtract from stock</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Stock Value</label>
              <input
                type="number"
                min="0"
                className="w-full mt-1 p-2 border rounded-md"
                value={formData.value || ''}
                onChange={(e) => setFormData({...formData, value: parseInt(e.target.value)})}
                placeholder="e.g., 100"
              />
            </div>
          </div>
        );
      default:
        return <div>Unknown operation</div>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {renderForm()}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Apply Changes</Button>
      </div>
    </form>
  );
}
