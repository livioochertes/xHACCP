import { useQuery } from "@tanstack/react-query";

export interface MarketContact {
  name?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  registrationNumber?: string;
}

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
  marketContacts?: {
    ro?: MarketContact;
    fr?: MarketContact;
    com?: MarketContact;
  };
}

function getCurrentMarket(): 'ro' | 'fr' | 'com' {
  try {
    const hostname = window.location.hostname;
    if (hostname === 'xhaccp.ro' || hostname.endsWith('.xhaccp.ro')) return 'ro';
    if (hostname === 'xhaccp.fr' || hostname.endsWith('.xhaccp.fr')) return 'fr';
  } catch {}
  return 'com';
}

export function useCompanySettings() {
  const market = getCurrentMarket();

  const { data: settings, isLoading } = useQuery<PublicCompanySettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 5 * 60 * 1000,
  });

  const marketData = settings?.marketContacts?.[market];

  const contact: MarketContact = {
    name: marketData?.name || settings?.name || '',
    address: marketData?.address || settings?.address || '',
    city: marketData?.city || settings?.city || '',
    zipCode: marketData?.zipCode || settings?.zipCode || '',
    country: marketData?.country || settings?.country || '',
    phone: marketData?.phone || settings?.phone || '',
    email: marketData?.email || settings?.email || '',
    vatNumber: marketData?.vatNumber || settings?.vatNumber || '',
    registrationNumber: marketData?.registrationNumber || settings?.registrationNumber || '',
  };

  return { settings, contact, market, isLoading };
}
