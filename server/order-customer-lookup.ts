export type CustomerAddressSuggestion = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

export type RomanianOrderCustomerSuggestion = {
  orderId: number;
  createdAt: string | null;
  companyName: string;
  vatNumber: string;
  registrationNumber: string;
  shippingAddress: CustomerAddressSuggestion;
  billingAddress: CustomerAddressSuggestion;
};

type OrderSuggestionSource = {
  id: number;
  createdAt: Date | string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function sanitizeAddress(
  address: Record<string, unknown>,
  fallback: Record<string, unknown> = {},
): CustomerAddressSuggestion {
  return {
    firstName: firstText(address.firstName, fallback.firstName),
    lastName: firstText(address.lastName, fallback.lastName),
    email: firstText(address.email, fallback.email),
    phone: firstText(address.phone, fallback.phone),
    streetAddress: firstText(address.streetAddress, address.address, fallback.streetAddress, fallback.address),
    city: firstText(address.city, fallback.city),
    state: firstText(address.state, address.county, fallback.state, fallback.county),
    zipCode: firstText(address.zipCode, address.postalCode, fallback.zipCode, fallback.postalCode),
    country: firstText(address.country, fallback.country),
  };
}

/**
 * Treat RO123, ro 123, and 123 as the same Romanian CUI/VAT code.
 * Romanian identifiers are numeric and contain at most ten digits.
 */
export function normalizeRomanianVatCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const compact = String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = compact.replace(/^RO(?=\d)/, "");
  return /^\d{2,10}$/.test(digits) ? digits : null;
}

/**
 * Return only the customer fields needed by the manual-order form.
 * Never return notes, payment information, products, or other order data.
 */
export function toRomanianOrderCustomerSuggestion(
  source: OrderSuggestionSource,
): RomanianOrderCustomerSuggestion {
  const shipping = asRecord(source.shippingAddress);
  const billing = asRecord(source.billingAddress);
  const createdAt = source.createdAt instanceof Date
    ? source.createdAt.toISOString()
    : typeof source.createdAt === "string"
      ? source.createdAt
      : null;

  return {
    orderId: source.id,
    createdAt,
    companyName: firstText(billing.companyName, shipping.companyName),
    vatNumber: firstText(billing.vatNumber, shipping.vatNumber),
    registrationNumber: firstText(
      billing.registrationNumber,
      billing.regCom,
      shipping.registrationNumber,
      shipping.regCom,
    ),
    shippingAddress: sanitizeAddress(shipping),
    billingAddress: sanitizeAddress(billing, shipping),
  };
}