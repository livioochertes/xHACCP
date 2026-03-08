import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Settings, 
  Shield,
  LogOut,
  Eye,
  Calendar,
  DollarSign,
  Search,
  Filter,
  Truck,
  Download,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import AdminTwoFactor from "./AdminTwoFactor";
import ShippingSettings from "./ShippingSettings";

interface AdminDashboardProps {
  token: string;
  admin: any;
  onLogout: () => void;
}

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  recentOrders: any[];
}

export default function AdminDashboard({ token, admin, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/admin/api/stats'],
    queryFn: async () => {
      const response = await fetch('/admin/api/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      return response.json();
    },
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/admin/api/profile'],
    queryFn: async () => {
      const response = await fetch('/admin/api/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      return response.json();
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/admin/api/products'],
    queryFn: async () => {
      const response = await fetch('/admin/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      return response.json();
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/admin/api/orders'],
    queryFn: async () => {
      const response = await fetch('/admin/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // If token is expired, log error and show auth issue
        if (response.status === 401) {
          console.error('Admin token expired, please re-login');
          toast({
            title: "Session Expired",
            description: "Please refresh the page and login again",
            variant: "destructive",
          });
        }
        throw new Error('Failed to fetch orders');
      }

      const ordersData = await response.json();
      console.log('📋 Orders loaded successfully:', ordersData.length, 'orders');
      console.log('📋 First few orders:', ordersData.slice(0, 3));
      return ordersData;
    },
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/admin/api/categories'],
    queryFn: async () => {
      const response = await fetch('/admin/api/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      return response.json();
    },
  });

  // Filtered products
  const filteredProducts = useMemo(() => {
    console.log("🔍 Filtering products with:", { 
      searchQuery, 
      categoryFilter, 
      statusFilter, 
      stockFilter, 
      productsCount: products.length,
      productsData: products.slice(0, 2) // Show first 2 products for debugging
    });
    let filtered = products.filter((product: any) => {
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
    
    // Sort products
    filtered.sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "price":
          aValue = parseFloat(a.price) || 0;
          bValue = parseFloat(b.price) || 0;
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
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [products, searchQuery, categoryFilter, statusFilter, stockFilter, sortBy, sortOrder]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    console.log("🔍 Filtering orders with:", { orderSearchQuery, orderStatusFilter, ordersCount: orders.length });
    console.log("🔍 Raw orders data:", orders.slice(0, 2)); // Log first 2 orders for debugging
    let filtered = orders.filter((order: any) => {
      // Search filter
      if (orderSearchQuery) {
        const searchLower = orderSearchQuery.toLowerCase();
        const matchesSearch = 
          order.id.toString().includes(searchLower) ||
          order.customerName?.toLowerCase().includes(searchLower) ||
          order.city?.toLowerCase().includes(searchLower) ||
          order.status.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (orderStatusFilter !== "all") {
        if (order.status !== orderStatusFilter) return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [orders, orderSearchQuery, orderStatusFilter]);

  const handleLogout = async () => {
    try {
      await fetch('/admin/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      onLogout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error('Logout error:', error);
      onLogout(); // Logout locally even if API call fails
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  xHACCP Admin
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Welcome, {admin.firstName || admin.email}</span>
                {admin.twoFactorEnabled && (
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalUsers || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalOrders || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalProducts || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest orders from customers</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-center py-8">Loading orders...</div>
                ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentOrders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="font-medium">Order #{order.id}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(order.totalAmount)}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {order.items.length} items
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No recent orders found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            {/* Search and Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filter Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by order ID, customer name, or city..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Force a refresh of the filtered results
                      console.log("Search button clicked - Current filters:", {
                        orderSearchQuery,
                        orderStatusFilter
                      });
                    }}
                  >
                    🔍 Search & Filter
                  </Button>
                </div>
                
                {/* Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order-status-filter">Status</Label>
                    <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                      <SelectTrigger id="order-status-filter">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Filter Summary */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredOrders.length} of {orders.length} orders
                  </span>
                  {(orderSearchQuery || orderStatusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOrderSearchQuery("");
                        setOrderStatusFilter("all");
                      }}
                      className="h-7"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="text-center py-8">Loading orders...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id}</TableCell>
                          <TableCell>{order.customerName || "N/A"}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                          <TableCell>{order.items?.length || 0}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <OrderStatusUpdate 
                                orderId={order.id} 
                                currentStatus={order.status}
                                onStatusUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/orders'] })}
                              />
                              <AWBActions
                                order={order}
                                onAWBGenerated={() => queryClient.invalidateQueries({ queryKey: ['/api/orders'] })}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
                      placeholder="Search by name, category, description, or ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        console.log("🔍 Search input changed:", e.target.value);
                        setSearchQuery(e.target.value);
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      console.log("🔍 Search button clicked!");
                      console.log("Current search query:", searchQuery);
                      console.log("Current filters:", {
                        categoryFilter,
                        statusFilter,
                        stockFilter
                      });
                      alert("Search button clicked! Check console for details.");
                    }}
                  >
                    🔍 Search & Filter
                  </Button>
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
                        {categories.map((category: any) => (
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
                {productsLoading ? (
                  <div className="text-center py-8">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p>No products found matching your search criteria.</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Total products: {products.length} | Filtered: {filteredProducts.length}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product: any) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category?.name || "No Category"}</TableCell>
                          <TableCell>${product.price}</TableCell>
                          <TableCell>{product.stockQuantity || 0}</TableCell>
                          <TableCell>
                            <Badge variant={product.status === "active" ? "default" : "secondary"}>
                              {product.status || "active"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Your admin account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profileLoading ? (
                    <div>Loading profile...</div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Email</label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{profile?.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {profile?.firstName && profile?.lastName 
                            ? `${profile.firstName} ${profile.lastName}`
                            : 'Not set'
                          }
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Two-Factor Authentication</label>
                        <div className="flex items-center space-x-2">
                          <Badge variant={profile?.twoFactorEnabled ? "default" : "secondary"}>
                            {profile?.twoFactorEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                          {profile?.twoFactorEnabled && (
                            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <AdminTwoFactor 
                token={token} 
                enabled={profile?.twoFactorEnabled || false}
                onUpdate={() => {
                  // Refresh profile data
                  window.location.reload();
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <ShippingSettings token={token} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Order Status Update Component
interface OrderStatusUpdateProps {
  orderId: number;
  currentStatus: string;
  onStatusUpdate: () => void;
}

function OrderStatusUpdate({ orderId, currentStatus, onStatusUpdate }: OrderStatusUpdateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const statusOptions = [
    { value: 'pending', label: 'Pending', description: 'Order awaiting review' },
    { value: 'processing', label: 'Processing', description: 'Order accepted and being prepared' },
    { value: 'shipped', label: 'Shipped', description: 'AWB generated, package shipped' },
    { value: 'delivered', label: 'Delivered', description: 'Package delivered to customer' },
    { value: 'cancelled', label: 'Cancelled', description: 'Order cancelled' }
  ];

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: { status: newStatus }
      });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Order status has been successfully updated.",
      });
      onStatusUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    updateStatusMutation.mutate(newStatus);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={updateStatusMutation.isPending}
    >
      <SelectTrigger className="w-40">
        <SelectValue>
          <Badge className={getStatusColor(currentStatus)}>
            {statusOptions.find(s => s.value === currentStatus)?.label || currentStatus}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <div className="flex flex-col">
              <span className="font-medium">{status.label}</span>
              <span className="text-xs text-muted-foreground">{status.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// AWB Actions Component
interface AWBActionsProps {
  order: any;
  onAWBGenerated: () => void;
}

function AWBActions({ order, onAWBGenerated }: AWBActionsProps) {
  const { toast } = useToast();

  const generateAWBMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/orders/${order.id}/generate-awb`, {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "AWB Generated Successfully",
        description: `AWB Number: ${data.awbNumber} - Order status updated to Shipped`,
      });
      onAWBGenerated();
    },
    onError: (error: any) => {
      toast({
        title: "AWB Generation Failed",
        description: error.message || "Failed to generate AWB with Sameday",
        variant: "destructive",
      });
    },
  });

  const downloadAWBPDF = async () => {
    try {
      const response = await fetch(`/api/orders/${order.id}/awb-pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download AWB PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AWB_${order.awbNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "AWB PDF has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download AWB PDF",
        variant: "destructive",
      });
    }
  };

  // Show different actions based on order status and AWB status
  if (order.awbNumber) {
    // AWB already exists
    return (
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadAWBPDF}
          title="Download AWB PDF"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`https://sameday.ro/status-colet/?awb=${order.awbNumber}`, '_blank')}
          title="Track Package"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show AWB generation button for processing orders
  console.log('AWBActions - Order status:', order.status, 'Order ID:', order.id, 'AWB Number:', order.awbNumber);
  
  if (order.status === 'processing') {
    console.log('Showing AWB generation button for order:', order.id);
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => generateAWBMutation.mutate()}
        disabled={generateAWBMutation.isPending}
        title="Generate AWB & Ship"
        className="text-purple-600 border-purple-200 hover:bg-purple-50"
      >
        {generateAWBMutation.isPending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
        ) : (
          <Truck className="h-4 w-4" />
        )}
      </Button>
    );
  }

  // No actions for pending or other statuses
  return null;
}