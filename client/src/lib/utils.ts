import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: string | number, currency?: string | null): string {
  const price = parseFloat(String(amount)).toFixed(2);
  switch ((currency || '').toUpperCase()) {
    case 'RON': return `${price} lei`;
    case 'EUR': return `€${price}`;
    case 'GBP': return `£${price}`;
    case 'USD': return `$${price}`;
    default: return currency ? `${price} ${currency}` : price;
  }
}

export function getCurrencySymbol(currency?: string | null): string {
  switch ((currency || '').toUpperCase()) {
    case 'RON': return 'lei';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'USD': return '$';
    default: return currency || '';
  }
}
