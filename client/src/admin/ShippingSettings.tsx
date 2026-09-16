import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Truck, Save, Package, Settings } from "lucide-react";

const shippingSettingsSchema = z.object({
  freeShippingThreshold: z.string().min(1, "Free shipping threshold is required"),
  standardShippingCost: z.string().min(1, "Standard shipping cost is required"),
});

const parcelCompanySettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  pickupPointCode: z.string().min(1, "Pick up point code is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  apiBaseUrl: z.string().url("Must be a valid URL"),
  isActive: z.boolean(),
  serviceId: z.number().min(1, "Service ID is required"),
  defaultPackageType: z.string().min(1, "Default package type is required"),
  defaultPaymentMethod: z.string().min(1, "Default payment method is required"),
});

type ShippingSettingsFormData = z.infer<typeof shippingSettingsSchema>;
type ParcelCompanySettingsFormData = z.infer<typeof parcelCompanySettingsSchema>;

interface ShippingSettingsProps {
  token: string;
}

export default function ShippingSettings({ token }: ShippingSettingsProps) {
  console.log('🚚 ShippingSettings component rendered with token:', token ? 'present' : 'missing');
  const [loading, setLoading] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch general company settings (for shipping costs)
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/admin/api/settings'],
    queryFn: async () => {
      console.log('🚚 ShippingSettings: Fetching settings...');
      const response = await fetch('/admin/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('🚚 ShippingSettings: Failed to fetch settings:', response.status);
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      console.log('🚚 ShippingSettings: Received data:', data);
      return data;
    },
  });

  // Fetch parcel company settings
  const { data: parcelSettings, isLoading: isParcelLoading } = useQuery({
    queryKey: ['/admin/api/shipping-settings'],
    queryFn: async () => {
      console.log('🚚 ParcelSettings: Fetching settings...');
      const response = await fetch('/admin/api/shipping-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('🚚 ParcelSettings: Failed to fetch settings:', response.status);
        throw new Error('Failed to fetch parcel settings');
      }

      const data = await response.json();
      console.log('🚚 ParcelSettings: Received data:', data);
      return data;
    },
  });

  // Shipping costs form
  const form = useForm<ShippingSettingsFormData>({
    resolver: zodResolver(shippingSettingsSchema),
    defaultValues: {
      freeShippingThreshold: settings?.freeShippingThreshold || "500.00",
      standardShippingCost: settings?.standardShippingCost || "25.00",
    },
  });

  // Parcel company settings form
  const parcelForm = useForm<ParcelCompanySettingsFormData>({
    resolver: zodResolver(parcelCompanySettingsSchema),
    defaultValues: {
      companyName: parcelSettings?.companyName || 'Sameday Courier',
      pickupPointCode: parcelSettings?.pickupPointCode || '',
      username: parcelSettings?.username || '',
      password: parcelSettings?.password || '',
      apiBaseUrl: parcelSettings?.apiBaseUrl || 'https://api.sameday.ro',
      isActive: parcelSettings?.isActive ?? true,
      serviceId: parcelSettings?.serviceId || 7,
      defaultPackageType: parcelSettings?.defaultPackageType || 'PARCEL',
      defaultPaymentMethod: parcelSettings?.defaultPaymentMethod || 'SENDER',
    },
  });

  // Update form values when settings load
  if (settings && !form.formState.isDirty) {
    form.reset({
      freeShippingThreshold: settings.freeShippingThreshold || "500.00",
      standardShippingCost: settings.standardShippingCost || "25.00",
    });
  }

  if (parcelSettings && !parcelForm.formState.isDirty) {
    parcelForm.reset({
      companyName: parcelSettings.companyName || 'Sameday Courier',
      pickupPointCode: parcelSettings.pickupPointCode || '',
      username: parcelSettings.username || '',
      password: parcelSettings.password || '',
      apiBaseUrl: parcelSettings.apiBaseUrl || 'https://api.sameday.ro',
      isActive: parcelSettings.isActive ?? true,
      serviceId: parcelSettings.serviceId || 7,
      defaultPackageType: parcelSettings.defaultPackageType || 'PARCEL',
      defaultPaymentMethod: parcelSettings.defaultPaymentMethod || 'SENDER',
    });
  }

  // Shipping costs mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: ShippingSettingsFormData) => {
      const response = await fetch('/admin/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          freeShippingThreshold: data.freeShippingThreshold,
          standardShippingCost: data.standardShippingCost,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shipping-settings'] });
      toast({
        title: "Settings Updated",
        description: "Shipping settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Parcel company settings mutation
  const updateParcelSettingsMutation = useMutation({
    mutationFn: async (data: ParcelCompanySettingsFormData) => {
      const response = await fetch('/admin/api/shipping-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update parcel company settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/admin/api/shipping-settings'] });
      toast({
        title: "Parcel Settings Updated",
        description: "Parcel company settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update parcel settings",
        variant: "destructive",
      });
    },
  });

  // Submit handlers
  const onSubmit = async (data: ShippingSettingsFormData) => {
    setLoading(true);
    try {
      await updateSettingsMutation.mutateAsync(data);
    } finally {
      setLoading(false);
    }
  };

  const onParcelSubmit = async (data: ParcelCompanySettingsFormData) => {
    setParcelLoading(true);
    try {
      await updateParcelSettingsMutation.mutateAsync(data);
    } finally {
      setParcelLoading(false);
    }
  };

  if (isLoading || isParcelLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Truck className="h-5 w-5" />
              <span>Shipping Settings</span>
            </CardTitle>
            <CardDescription>Configure shipping costs and parcel company settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div>Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shipping Costs Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="h-5 w-5" />
            <span>Shipping Costs</span>
          </CardTitle>
          <CardDescription>Configure shipping costs and free shipping threshold</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="freeShippingThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Free Shipping Threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="500.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="standardShippingCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Shipping Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="25.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={loading || updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading || updateSettingsMutation.isPending ? "Saving..." : "Save Shipping Costs"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Parcel Company Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Parcel Company Settings</span>
          </CardTitle>
          <CardDescription>Configure parcel company details for AWB generation</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...parcelForm}>
            <form onSubmit={parcelForm.handleSubmit(onParcelSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={parcelForm.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sameday Courier" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="pickupPointCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pick Up Point Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Configured in WMS → .ro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="API Username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="API Password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="apiBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Base URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.sameday.ro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service ID</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="7" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="defaultPackageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Package Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select package type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PARCEL">PARCEL</SelectItem>
                          <SelectItem value="ENVELOPE">ENVELOPE</SelectItem>
                          <SelectItem value="LARGE">LARGE</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={parcelForm.control}
                  name="defaultPaymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SENDER">SENDER</SelectItem>
                          <SelectItem value="RECIPIENT">RECIPIENT</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={parcelForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable this parcel company for AWB generation
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
              <div className="flex justify-end">
                <Button type="submit" disabled={parcelLoading || updateParcelSettingsMutation.isPending}>
                  <Settings className="h-4 w-4 mr-2" />
                  {parcelLoading || updateParcelSettingsMutation.isPending ? "Saving..." : "Save Parcel Settings"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}