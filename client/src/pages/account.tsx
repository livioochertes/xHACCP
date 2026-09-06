import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { User, Package, CreditCard, Bell, Settings, Download, Eye, Receipt, ExternalLink } from "lucide-react";
import { format } from "date-fns";

import { useLocation } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCountyOptions, getCitiesForCounty, getCountryOptions, romanianCounties } from "@/utils/location-data";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

const invoiceSchema = z.object({
  companyName: z.string().optional(),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  companyAddress: z.string().min(1, "Company address is required"),
  companyCity: z.string().min(1, "Company city is required"),
  companyState: z.string().optional(), // Optional - not mandatory
  companyCounty: z.string().min(1, "Company county (Județ) is required"), // Mandatory for Romanian invoices
  companyZip: z.string().optional(), // Optional - not mandatory
  companyCountry: z.string().min(1, "Company country is required"),
  billingEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  billingPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
  deliveryCounty: z.string().optional(), // Optional - will be auto-filled from company address when checkbox is checked
  deliveryZip: z.string().optional(),
  deliveryCountry: z.string().optional(),
  deliveryInstructions: z.string().optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  orderUpdates: z.boolean(),
  productRestocks: z.boolean(),
  priceDrops: z.boolean(),
  promotions: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type InvoiceFormData = z.infer<typeof invoiceSchema>;
type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;
type NotificationFormData = z.infer<typeof notificationSchema>;

export default function Account() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['profile', 'orders', 'invoices', 'subscriptions', 'invoice-settings', 'alerts'].includes(hash) ? hash : 'profile';
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<number | null>(null);
  const [copyCompanyAddress, setCopyCompanyAddress] = useState(false);
  const [selectedCompanyCounty, setSelectedCompanyCounty] = useState("");
  const [selectedDeliveryCounty, setSelectedDeliveryCounty] = useState("");
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: isAuthenticated,
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<any[]>({
    queryKey: ["/api/account/subscriptions"],
    enabled: isAuthenticated,
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/account/subscriptions/${id}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      trackEvent("subscription_cancelled", {
        market: getMarketFromHostname(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/account/subscriptions"] });
      toast({ title: "Subscription canceled", description: "Future renewals have been stopped." });
    },
    onError: (error: any) => {
      toast({ title: "Could not cancel subscription", description: error.message, variant: "destructive" });
    },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  const invoiceForm = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      companyName: "",
      vatNumber: "",
      registrationNumber: "",
      taxId: "",
      companyAddress: "",
      companyCity: "",
      companyState: "",
      companyCounty: "",
      companyZip: "",
      companyCountry: "",
      billingEmail: "",
      billingPhone: "",
      deliveryAddress: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryCounty: "",
      deliveryZip: "",
      deliveryCountry: "",
      deliveryInstructions: "",
    },
  });

  const passwordForm = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const notificationForm = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      orderUpdates: true,
      productRestocks: false,
      priceDrops: false,
      promotions: true,
    },
  });

  // Update forms when user data changes
  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
      
      invoiceForm.reset({
        companyName: user.companyName || "",
        vatNumber: user.vatNumber || "",
        registrationNumber: user.registrationNumber || "",
        taxId: user.taxId || "",
        companyAddress: user.companyAddress || "",
        companyCity: user.companyCity || "",
        companyState: user.companyState || "",
        companyCounty: user.companyCounty || "",
        companyZip: user.companyZip || "",
        companyCountry: user.companyCountry || "",
        billingEmail: user.billingEmail || "",
        billingPhone: user.billingPhone || "",
        deliveryAddress: user.deliveryAddress || "",
        deliveryCity: user.deliveryCity || "",
        deliveryState: user.deliveryState || "",
        deliveryCounty: user.deliveryCounty || "",
        deliveryZip: user.deliveryZip || "",
        deliveryCountry: user.deliveryCountry || "",
        deliveryInstructions: user.deliveryInstructions || "",
      });
      
      // Initialize selected county states with existing data
      setSelectedCompanyCounty(user.companyCounty || '');
      setSelectedDeliveryCounty(user.deliveryCounty || '');

      notificationForm.reset({
        emailNotifications: user.emailNotifications ?? true,
        orderUpdates: user.orderUpdates ?? true,
        productRestocks: user.productRestocks ?? false,
        priceDrops: user.priceDrops ?? false,
        promotions: user.promotions ?? true,
      });
    }
  }, [user, profileForm, invoiceForm, notificationForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PUT", "/api/auth/profile", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Update the auth state with the new user data
      if (updatedUser) {
        updateUser(updatedUser);
      }
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Update invoice details mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const response = await apiRequest("PUT", "/api/auth/invoice", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Invoice details updated",
        description: "Your invoice details have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Update the auth state with the new user data
      if (updatedUser) {
        updateUser(updatedUser);
      }
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update invoice details.",
        variant: "destructive",
      });
    },
  });

  // Create invoice from order mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/invoice`, {
        paymentMethod: 'wire_transfer'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invoice created",
        description: "Invoice has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error) => {
      toast({
        title: "Invoice creation failed",
        description: error.message || "Failed to create invoice.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleInvoiceSubmit = (data: InvoiceFormData) => {
    updateInvoiceMutation.mutate(data);
  };

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordChangeFormData) => {
      const response = await apiRequest("PUT", "/api/auth/change-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
      setPasswordDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Password change failed",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    },
  });

  // Notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      const response = await apiRequest("PUT", "/api/auth/notifications", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Notification preferences updated",
        description: "Your notification settings have been saved.",
      });
      setNotificationDialogOpen(false);
      
      // Update the user state with new notification preferences
      if (user) {
        updateUser({
          ...user,
          emailNotifications: result.preferences.emailNotifications,
          orderUpdates: result.preferences.orderUpdates,
          productRestocks: result.preferences.productRestocks,
          priceDrops: result.preferences.priceDrops,
          promotions: result.preferences.promotions,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update notification settings.",
        variant: "destructive",
      });
    },
  });

  const handlePasswordSubmit = (data: PasswordChangeFormData) => {
    changePasswordMutation.mutate(data);
  };

  const handleNotificationSubmit = (data: NotificationFormData) => {
    updateNotificationsMutation.mutate(data);
  };

  const handleNotificationChange = (field: keyof NotificationFormData, value: boolean) => {
    const currentValues = notificationForm.getValues();
    const updatedData = { ...currentValues, [field]: value };
    
    // Update form state immediately
    notificationForm.setValue(field, value);
    
    // Save to backend automatically
    updateNotificationsMutation.mutate(updatedData);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Don't render anything if not authenticated
  if (!isLoading && !isAuthenticated) {
    return null;
  }

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': 
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'processing': 
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'shipped': 
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'in_delivery': 
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'delivered': 
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': 
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: 
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  const getOrderStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'Pending Review';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'in_delivery': return 'In Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };



  const downloadInvoice = async (orderId: number) => {
    setDownloadingInvoice(orderId);
    
    try {
      const existingInvoice = invoices.find(inv => inv.orderId === orderId);
      
      if (existingInvoice) {
        const pdfResponse = await fetch(`/api/account/invoices/${existingInvoice.id}/pdf`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'X-Market': getMarketFromHostname() }
        });
        
        if (pdfResponse.ok) {
          const blob = await pdfResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Factura_${existingInvoice.invoiceNumber.replace(/\s+/g, '_')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          setDownloadingInvoice(null);
          return;
        }
        
        navigate(`/invoice/${existingInvoice.invoiceNumber}`);
        setDownloadingInvoice(null);
        return;
      }

      const response = await fetch(`/api/orders/${orderId}/create-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
          'X-Market': getMarketFromHostname()
        }
      });
      
      if (response.ok) {
        const invoiceData = await response.json();
        
        if (invoiceData && invoiceData.invoiceNumber) {
          const pdfResponse = await fetch(`/api/account/invoices/${invoiceData.id}/pdf`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'X-Market': getMarketFromHostname() }
          });
          
          if (pdfResponse.ok) {
            const blob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Factura_${invoiceData.invoiceNumber.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } else {
            navigate(`/invoice/${invoiceData.invoiceNumber}`);
          }
          
          toast({
            title: t('account.invoiceCreated'),
            description: t('account.invoiceCreatedDesc'),
          });
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          throw new Error('Invalid invoice data returned from server');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned error: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Error accessing invoice:', error);
      toast({
        title: t('account.invoiceError'),
        description: error.message || t('account.invoiceErrorDesc'),
        variant: "destructive"
      });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const viewOrderDetails = async (order: any) => {
    try {
      // Fetch complete order details with product information
      const response = await fetch(`/api/orders/${order.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Market': getMarketFromHostname(),
        }
      });
      
      if (response.ok) {
        const fullOrder = await response.json();
        setSelectedOrder(fullOrder);
      } else {
        console.error('Failed to fetch order details');
        setSelectedOrder(order); // Fallback to basic order data
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      setSelectedOrder(order); // Fallback to basic order data
    }
    
    setOrderDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">{t('common.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('account.title')}</h1>
            <p className="text-gray-600 mt-2">
              {t('account.welcomeBack').replace('{name}', user?.firstName || '')}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('account.profile')}
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('account.orders')}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('account.invoices')}
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Subscriptions
              </TabsTrigger>
              <TabsTrigger value="invoice-settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {t('account.settings')}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t('account.alerts')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('account.personalInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('account.firstName')}</FormLabel>
                              <FormControl>
                                <Input placeholder="John" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('account.lastName')}</FormLabel>
                              <FormControl>
                                <Input placeholder="Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('account.email')}</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="your@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        disabled={updateProfileMutation.isPending}
                        className="w-full md:w-auto"
                      >
                        {updateProfileMutation.isPending ? t('common.loading') : t('account.save')}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t('account.accountSettings')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{t('account.emailNotifications')}</h3>
                        <p className="text-sm text-gray-600">{t('account.emailNotificationsDesc')}</p>
                      </div>
                      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            {t('account.configure')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>{t('account.notifications.title')}</DialogTitle>
                          </DialogHeader>
                          <Form {...notificationForm}>
                            <form onSubmit={notificationForm.handleSubmit(handleNotificationSubmit)} className="space-y-4">
                              <FormField
                                control={notificationForm.control}
                                name="emailNotifications"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">{t('account.notifications.emailTitle')}</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        {t('account.notifications.emailDesc')}
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={notificationForm.control}
                                name="orderUpdates"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">{t('account.notifications.orderTitle')}</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        {t('account.notifications.orderDesc')}
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={notificationForm.control}
                                name="productRestocks"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">{t('account.notifications.restockTitle')}</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        {t('account.notifications.restockDesc')}
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={notificationForm.control}
                                name="priceDrops"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">{t('account.notifications.priceTitle')}</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        {t('account.notifications.priceDesc')}
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={notificationForm.control}
                                name="promotions"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">{t('account.notifications.promosTitle')}</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        {t('account.notifications.promosDesc')}
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <div className="flex justify-end gap-3">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => setNotificationDialogOpen(false)}
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button 
                                  type="submit" 
                                  disabled={updateNotificationsMutation.isPending}
                                >
                                  {updateNotificationsMutation.isPending ? t('account.notifications.saving') : t('account.notifications.saveSettings')}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{t('account.password')}</h3>
                        <p className="text-sm text-gray-600">{t('account.passwordDesc')}</p>
                      </div>
                      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            {t('account.change')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>{t('account.passwordChange.title')}</DialogTitle>
                          </DialogHeader>
                          <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                              <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('account.passwordChange.current')}</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder={t('account.passwordChange.currentPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('account.passwordChange.new')}</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder={t('account.passwordChange.newPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('account.passwordChange.confirm')}</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder={t('account.passwordChange.confirmPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex justify-end gap-3">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => setPasswordDialogOpen(false)}
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button 
                                  type="submit" 
                                  disabled={changePasswordMutation.isPending}
                                >
                                  {changePasswordMutation.isPending ? t('account.passwordChange.changing') : t('account.passwordChange.changeButton')}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('account.orderHistory')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">{t('account.loadingOrders')}</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">{t('account.noOrders')}</p>
                      <Button 
                        onClick={() => navigate("/products")}
                        className="mt-4"
                      >
                        {t('account.startShopping')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order: any) => (
                        <div key={order.id} className="border rounded-lg p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <div>
                                <h3 className="font-medium">{t('account.orderNumber')}{order.id}</h3>
                                <p className="text-sm text-gray-600">
                                  {format(new Date(order.createdAt), "PPP")}
                                </p>
                              </div>
                              <Badge className={getOrderStatusColor(order.status)}>
                                {getOrderStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{order.totalAmount} lei</p>
                              <p className="text-sm text-gray-600">
                                {order.items?.length || 0} {t('account.items')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => viewOrderDetails(order)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t('account.viewDetails')}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadInvoice(order.id)}
                              disabled={downloadingInvoice === order.id}
                            >
                              {downloadingInvoice === order.id ? (
                                <>
                                  <div className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4 mr-1" />
                                  {t('account.invoice')}
                                </>
                              )}
                            </Button>
                            {order.awbNumber && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(`https://sameday.ro/status-colet/?awb=${order.awbNumber}`, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Track Package
                              </Button>
                            )}
                            {order.status.toLowerCase() === "delivered" && (
                              <Button variant="outline" size="sm">
                                {t('account.reorder')}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    {t('account.invoices')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {invoicesLoading ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">{t('account.loadingInvoices')}</p>
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">{t('account.noInvoices')}</p>
                      <p className="text-sm text-gray-500">{t('account.createInvoicesFromOrders')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      {invoices.map((invoice: any) => (
                        <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{invoice.invoiceNumber}</h3>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {invoice.paymentMethod === 'wire_transfer' ? 'Wire Transfer' : invoice.paymentMethod}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              Order #{invoice.orderId} • {format(new Date(invoice.issueDate), "PPP")}
                            </p>
                            <p className="text-xs text-gray-500">
                              {invoice.itemCount || invoice.items?.length || 0} items • {invoice.totalAmount} lei
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/invoice/${invoice.invoiceNumber}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t('account.viewDetails') || 'View'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
                                  const resp = await fetch(`/api/invoices/${invoice.id}/pdf`, {
                                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                                  });
                                  if (!resp.ok) throw new Error('PDF not available');
                                  const blob = await resp.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `factura_${invoice.invoiceNumber?.replace(/[^a-zA-Z0-9]/g, '_') || invoice.id}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                } catch {
                                  alert(t('account.pdfNotAvailable') || 'PDF not yet available for this invoice.');
                                }
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              {t('account.downloadPdf') || 'PDF'}
                            </Button>
                            {invoice.paymentLink && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(invoice.paymentLink, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Pay
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create invoices from orders section */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">{t('account.createInvoice')}</h3>
                    {orders.filter((order: any) => 
                      order.status === "delivered" && 
                      !invoices.some((invoice: any) => invoice.orderId === order.id)
                    ).length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">
                          {t('account.noOrdersForInvoice')}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {t('account.onlyDeliveredOrders')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders
                          .filter((order: any) => 
                            order.status === "delivered" && 
                            !invoices.some((invoice: any) => invoice.orderId === order.id)
                          )
                          .map((order: any) => (
                            <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2">
                              <div className="min-w-0">
                                <h4 className="font-medium">Order #{order.id}</h4>
                                <p className="text-sm text-gray-600">
                                  {format(new Date(order.createdAt), "PPP")} • {order.totalAmount} lei
                                </p>
                              </div>
                              <Button 
                                size="sm"
                                className="shrink-0 self-start sm:self-center"
                                onClick={() => createInvoiceMutation.mutate(order.id)}
                                disabled={createInvoiceMutation.isPending}
                              >
                                {createInvoiceMutation.isPending ? t('common.creating') : t('account.createInvoice')}
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptionsLoading ? (
                    <div className="text-center py-8 text-gray-600">Loading subscriptions…</div>
                  ) : subscriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">You have no active subscriptions.</div>
                  ) : (
                    <div className="space-y-4">
                      {subscriptions.map((subscription: any) => (
                        <div key={subscription.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4">
                          <div className="flex items-center gap-3">
                            {subscription.productImageUrl && <img src={subscription.productImageUrl} alt="" className="h-12 w-12 rounded object-cover" />}
                            <div>
                              <h3 className="font-medium">{subscription.productName}</h3>
                              <p className="text-sm text-gray-600">
                                {subscription.amount} {subscription.currency} / month · {subscription.status}
                              </p>
                              {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                                <p className="text-xs text-gray-500">Next charge: {format(new Date(subscription.nextBillingAt), "PPP")}</p>
                              )}
                              {subscription.status === "past_due" && (
                                <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                                  <p className="font-semibold">Subscription payment failed</p>
                                  <p className="mt-1">
                                    Please pay the outstanding subscription or replace your card to restore automatic billing.
                                  </p>
                                </div>
                              )}
                              {subscription.cancelAtPeriodEnd && <Badge variant="outline">Canceling at period end</Badge>}
                            </div>
                          </div>
                          {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelSubscriptionMutation.mutate(subscription.id)}
                              disabled={cancelSubscriptionMutation.isPending}
                            >
                              Cancel renewal
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoice-settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t('account.invoiceDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...invoiceForm}>
                    <form onSubmit={invoiceForm.handleSubmit(handleInvoiceSubmit)} className="space-y-6">
                      
                      {/* Company Information Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">{t('account.companyInfo')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={invoiceForm.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.companyName')}</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your Company Ltd." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={invoiceForm.control}
                            name="vatNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>VAT Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="GB123456789" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={invoiceForm.control}
                            name="registrationNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company Registration Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="12345678" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={invoiceForm.control}
                            name="taxId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="123-45-6789" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Company Address Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">{t('account.companyAddress')}</h3>
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={invoiceForm.control}
                            name="companyAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.streetAddress')} *</FormLabel>
                                <FormControl>
                                  <Input placeholder="123 Business Street" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={invoiceForm.control}
                              name="companyCity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.city')} *</FormLabel>
                                  <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                    disabled={!selectedCompanyCounty}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={selectedCompanyCounty ? "Select city..." : "Select county first"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {selectedCompanyCounty && romanianCounties
                                        .find(county => county.name === selectedCompanyCounty)
                                        ?.cities.map((city) => (
                                          <SelectItem key={city} value={city}>
                                            {city}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={invoiceForm.control}
                              name="companyState"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.stateProvince')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Bucharest" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={invoiceForm.control}
                              name="companyCounty"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>County (Județ) *</FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setSelectedCompanyCounty(value);
                                    }} 
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select county..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {getCountyOptions().map((county) => (
                                        <SelectItem key={county.code} value={county.value}>
                                          {county.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={invoiceForm.control}
                              name="companyZip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.zipCode')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder="012345" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={invoiceForm.control}
                            name="companyCountry"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.country')} *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {getCountryOptions().map((country) => (
                                      <SelectItem key={country.code} value={country.value}>
                                        {country.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Contact Information Section */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">{t('account.billingContact')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={invoiceForm.control}
                            name="billingEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.billingEmail')}</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="billing@company.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={invoiceForm.control}
                            name="billingPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.billingPhone')}</FormLabel>
                                <FormControl>
                                  <Input placeholder="+44 20 7123 4567" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Delivery Address Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">{t('account.deliveryAddress')}</h3>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="copy-company-address"
                              checked={copyCompanyAddress}
                              onCheckedChange={(checked) => {
                                setCopyCompanyAddress(checked);
                                if (checked) {
                                  // Auto-fill delivery address with company address values
                                  const companyValues = invoiceForm.getValues();
                                  invoiceForm.setValue('deliveryAddress', companyValues.companyAddress || '');
                                  invoiceForm.setValue('deliveryCity', companyValues.companyCity || '');
                                  invoiceForm.setValue('deliveryState', companyValues.companyState || '');
                                  invoiceForm.setValue('deliveryCounty', companyValues.companyCounty || '');
                                  invoiceForm.setValue('deliveryZip', companyValues.companyZip || '');
                                  invoiceForm.setValue('deliveryCountry', companyValues.companyCountry || '');
                                  // Also update the selected county state for delivery
                                  setSelectedDeliveryCounty(companyValues.companyCounty || '');
                                  
                                  // Use the actual selectedCompanyCounty state instead of form values for better consistency
                                  const actualCompanyCounty = selectedCompanyCounty || companyValues.companyCounty || '';
                                  setSelectedDeliveryCounty(actualCompanyCounty);
                                  
                                  // Force form update to ensure city field refreshes with correct value
                                  setTimeout(() => {
                                    invoiceForm.setValue('deliveryCity', companyValues.companyCity || '');
                                    invoiceForm.setValue('deliveryCounty', actualCompanyCounty);
                                  }, 100);
                                } else {
                                  // Clear delivery address fields when unchecked
                                  invoiceForm.setValue('deliveryAddress', '');
                                  invoiceForm.setValue('deliveryCity', '');
                                  invoiceForm.setValue('deliveryState', '');
                                  invoiceForm.setValue('deliveryCounty', '');
                                  invoiceForm.setValue('deliveryZip', '');
                                  invoiceForm.setValue('deliveryCountry', '');
                                  // Also clear the selected county state for delivery
                                  setSelectedDeliveryCounty('');
                                }
                              }}
                            />
                            <Label htmlFor="copy-company-address" className="text-sm font-medium">
                              Same as Company Address
                            </Label>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={invoiceForm.control}
                            name="deliveryAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.deliveryStreetAddress')}{!copyCompanyAddress && ' *'}</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="456 Delivery Street" 
                                    disabled={copyCompanyAddress}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={invoiceForm.control}
                              name="deliveryCity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.city')}{!copyCompanyAddress && ' *'}</FormLabel>
                                  <Select 
                                    onValueChange={field.onChange} 
                                    value={field.value}
                                    disabled={copyCompanyAddress || !selectedDeliveryCounty}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={!copyCompanyAddress && selectedDeliveryCounty ? "Select city..." : "Select county first"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {selectedDeliveryCounty && romanianCounties
                                        .find(county => county.name === selectedDeliveryCounty)
                                        ?.cities.map((city) => (
                                          <SelectItem key={city} value={city}>
                                            {city}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={invoiceForm.control}
                              name="deliveryState"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.stateProvince')}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Bucharest" 
                                      disabled={copyCompanyAddress}
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={invoiceForm.control}
                              name="deliveryCounty"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>County (Județ){!copyCompanyAddress && ' *'}</FormLabel>
                                  <Select 
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      setSelectedDeliveryCounty(value);
                                    }} 
                                    value={field.value}
                                    disabled={copyCompanyAddress}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select county..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {getCountyOptions().map((county) => (
                                        <SelectItem key={county.code} value={county.value}>
                                          {county.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={invoiceForm.control}
                              name="deliveryZip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('account.zipCode')}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="012345" 
                                      disabled={copyCompanyAddress}
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={invoiceForm.control}
                            name="deliveryCountry"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.country')}{!copyCompanyAddress && ' *'}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={copyCompanyAddress}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {getCountryOptions().map((country) => (
                                      <SelectItem key={country.code} value={country.value}>
                                        {country.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={invoiceForm.control}
                            name="deliveryInstructions"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('account.deliveryInstructions')}</FormLabel>
                                <FormControl>
                                  <textarea 
                                    className={`flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${copyCompanyAddress ? 'opacity-50' : ''}`}
                                    placeholder="Please ring the bell at the main entrance. Loading dock is at the back of the building."
                                    disabled={copyCompanyAddress}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button 
                          type="submit" 
                          disabled={updateInvoiceMutation.isPending}
                          className="min-w-[120px]"
                        >
                          {updateInvoiceMutation.isPending ? t('account.updating') : t('account.updateInvoiceSettings')}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t('account.alertsTitle')}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{t('account.alertsDesc')}</p>
                </CardHeader>
                <CardContent>
                  <Form {...notificationForm}>
                    <div className="space-y-6">
                      <FormField
                        control={notificationForm.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">{t('account.alertsEmailTitle')}</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                {t('account.alertsEmailDesc')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(value) => handleNotificationChange('emailNotifications', value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="orderUpdates"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">{t('account.alertsOrderTitle')}</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                {t('account.alertsOrderDesc')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(value) => handleNotificationChange('orderUpdates', value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="productRestocks"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">{t('account.alertsRestockTitle')}</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                {t('account.alertsRestockDesc')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(value) => handleNotificationChange('productRestocks', value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="priceDrops"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">{t('account.alertsPriceTitle')}</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                {t('account.alertsPriceDesc')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(value) => handleNotificationChange('priceDrops', value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="promotions"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">{t('account.alertsPromosTitle')}</FormLabel>
                              <div className="text-sm text-muted-foreground">
                                {t('account.alertsPromosDesc')}
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(value) => handleNotificationChange('promotions', value)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {updateNotificationsMutation.isPending && (
                        <div className="flex justify-center pt-2">
                          <p className="text-sm text-gray-600">{t('account.notifications.saving')}</p>
                        </div>
                      )}
                    </div>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Order Details Modal */}
      <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details #{selectedOrder?.id}
          </DialogTitle>
        </DialogHeader>
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Order Date:</span>
                  <span className="text-sm">{format(new Date(selectedOrder.createdAt), "PPP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge className={getOrderStatusColor(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Payment Method:</span>
                  <span className="text-sm capitalize">{selectedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Payment Status:</span>
                  <Badge variant={selectedOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                    {selectedOrder.paymentStatus}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Amount:</span>
                  <span className="text-sm font-medium">{selectedOrder.totalAmount} lei</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Items:</span>
                  <span className="text-sm">{selectedOrder.items?.length || 0} items</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {selectedOrder.shippingAddress && (
              <div className="space-y-2">
                <h4 className="font-medium">Shipping Address</h4>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {selectedOrder.shippingAddress.name && <p className="font-medium">{selectedOrder.shippingAddress.name}</p>}
                  {selectedOrder.shippingAddress.street && <p>{selectedOrder.shippingAddress.street}</p>}
                  <p>
                    {selectedOrder.shippingAddress.city}
                    {selectedOrder.shippingAddress.state && `, ${selectedOrder.shippingAddress.state}`}
                    {selectedOrder.shippingAddress.zipCode && ` ${selectedOrder.shippingAddress.zipCode}`}
                  </p>
                  {selectedOrder.shippingAddress.country && <p>{selectedOrder.shippingAddress.country}</p>}
                  {selectedOrder.shippingAddress.phone && <p className="mt-2">📞 {selectedOrder.shippingAddress.phone}</p>}
                </div>
              </div>
            )}

            {/* Billing Address */}
            {selectedOrder.billingAddress && (
              <div className="space-y-2">
                <h4 className="font-medium">Billing Address</h4>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  {selectedOrder.billingAddress.name && <p className="font-medium">{selectedOrder.billingAddress.name}</p>}
                  {selectedOrder.billingAddress.street && <p>{selectedOrder.billingAddress.street}</p>}
                  <p>
                    {selectedOrder.billingAddress.city}
                    {selectedOrder.billingAddress.state && `, ${selectedOrder.billingAddress.state}`}
                    {selectedOrder.billingAddress.zipCode && ` ${selectedOrder.billingAddress.zipCode}`}
                  </p>
                  {selectedOrder.billingAddress.country && <p>{selectedOrder.billingAddress.country}</p>}
                  {selectedOrder.billingAddress.phone && <p className="mt-2">📞 {selectedOrder.billingAddress.phone}</p>}
                </div>
              </div>
            )}

            {/* Order Items */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Order Items</h4>
                <div className="border rounded-md">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 border-b last:border-b-0">
                      {/* Product Image */}
                      {item.product?.imageUrl && (
                        <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                          <img 
                            src={item.product.imageUrl} 
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.product?.name || item.productName || `Product #${item.productId}`}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Qty: {item.quantity}</span>
                          <span>Unit Price: {parseFloat(item.price).toFixed(2)} lei</span>
                          {item.product?.slug && (
                            <button 
                              onClick={() => navigate(`/product/${item.product.slug}`)}
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              View Product
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium">{parseFloat(item.totalPrice || (parseFloat(item.price) * item.quantity)).toFixed(2)} lei</p>
                        <p className="text-sm text-gray-600">Total</p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Order Total Breakdown */}
                  {(() => {
                    const shippingCost = parseFloat(selectedOrder.shippingCost || '0');
                    const discountAmt = parseFloat(selectedOrder.discountAmount || '0');
                    const voucherCode = selectedOrder.voucherCode || '';
                    const itemsSubtotal = (parseFloat(selectedOrder.totalAmount) + discountAmt - shippingCost).toFixed(2);
                    return (
                      <div className="bg-gray-50 p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{itemsSubtotal} lei</span>
                        </div>
                        {discountAmt > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount voucher{voucherCode ? ` ${voucherCode}` : ''}:</span>
                            <span>-{discountAmt.toFixed(2)} lei</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Transport:</span>
                          <span>{shippingCost > 0 ? `${shippingCost.toFixed(2)} lei` : 'Gratuit'}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 mt-1">
                          <span>Total:</span>
                          <span>{parseFloat(selectedOrder.totalAmount).toFixed(2)} lei</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedOrder.notes && (
              <div className="space-y-2">
                <h4 className="font-medium">Order Notes</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{selectedOrder.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOrderDetailsOpen(false)}>
                Close
              </Button>
              <Button onClick={() => downloadInvoice(selectedOrder.id)}>
                <Download className="h-4 w-4 mr-2" />
                View Invoice
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </div>
  );
}