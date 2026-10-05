import { useQuery } from "@tanstack/react-query";

export interface PublicCompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  vatNumber?: string;
  registrationNumber?: string;
  description?: string;
}

function getCurrentMarket(): 'ro' | 'fr' | 'com' {
  try {
    const hostname = window.location.hostname;
    if (hostname === 'xhaccp.ro' || hostname.endsWith('.xhaccp.ro')) return 'ro';
    if (hostname === 'xhaccp.fr' || hostname.endsWith('.xhaccp.fr')) return 'fr';
    if (hostname === 'xhaccp.com' || hostname.endsWith('.xhaccp.com')) return 'com';
  } catch {}
  return 'ro';
}

export function useCompanySettings() {
  const market = getCurrentMarket();

  const { data: settings, isLoading } = useQuery<PublicCompanySettings>({
    queryKey: ['/api/company-settings', market],
    staleTime: 5 * 60 * 1000,
  });

  const contact = {
    name: settings?.name || '',
    address: settings?.address || '',
    city: settings?.city || '',
    zipCode: settings?.zipCode || '',
    country: settings?.country || '',
    phone: settings?.phone || '',
    email: settings?.email || '',
    vatNumber: settings?.vatNumber || '',
    registrationNumber: settings?.registrationNumber || '',
  };

  return { settings, contact, market, isLoading };
}
