export type AdminCustomerAccountSource = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin?: boolean | null;
  adminMarkets?: string[] | null;
};

export type AdminCustomerOrderSource = {
  id: number;
  userId: number | null;
  market: string | null;
  createdAt: Date | string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  notes?: string | null;
};

export type AdminCustomerListRow = {
  customerKey: string;
  id: number | null;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isAdmin: boolean;
  isRegistered: boolean;
  adminMarkets: string[];
  markets: string[];
  orderCount: number;
  lastOrderAt: string | null;
  lastOrderId: number | null;
};

type MutableCustomer = Omit<AdminCustomerListRow, "markets"> & {
  markets: Set<string>;
  lastOrderTimestamp: number | null;
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

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email || null;
}

function extractGuestEmail(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.match(/\bguest\s+email\s*:\s*([^\s,;]+)/i)?.[1] || "";
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function parseOrderDate(value: Date | string | null): { value: string | null; timestamp: number | null } {
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === "string"
      ? Date.parse(value)
      : Number.NaN;

  return Number.isFinite(timestamp)
    ? { value: new Date(timestamp).toISOString(), timestamp }
    : { value: null, timestamp: null };
}

/**
 * Combines account records with order contacts. Guest orders are grouped by
 * normalized email (or phone if no email exists), while account actions remain
 * available only for customers with an actual account ID.
 */
export function buildAdminCustomerList(
  accounts: AdminCustomerAccountSource[],
  orders: AdminCustomerOrderSource[],
  marketScope: readonly string[] | null,
): AdminCustomerListRow[] {
  const scope = marketScope === null ? null : new Set(marketScope);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const accountsByEmail = new Map(
    accounts.flatMap((account) => {
      const email = normalizeEmail(account.email);
      return email ? [[email, account] as const] : [];
    }),
  );
  const customers = new Map<string, MutableCustomer>();
  const keyByAccountId = new Map<number, string>();
  const keyByEmail = new Map<string, string>();
  const keyByPhone = new Map<string, string>();

  const getOrCreateCustomer = (
    account: AdminCustomerAccountSource | undefined,
    email: string | null,
    displayEmail: string,
    fallbackKey: string,
  ): MutableCustomer => {
    const key = (account ? keyByAccountId.get(account.id) : undefined)
      || (email ? keyByEmail.get(email) : undefined)
      || fallbackKey;
    let customer = customers.get(key);

    if (!customer) {
      customer = {
        customerKey: key,
        id: null,
        email: "",
        firstName: "",
        lastName: "",
        displayName: "",
        isAdmin: false,
        isRegistered: false,
        adminMarkets: [],
        markets: new Set(),
        orderCount: 0,
        lastOrderAt: null,
        lastOrderId: null,
        lastOrderTimestamp: null,
      };
      customers.set(key, customer);
    }

    if (account) {
      customer.id = account.id;
      customer.isRegistered = true;
      customer.isAdmin = Boolean(account.isAdmin);
      customer.adminMarkets = Array.isArray(account.adminMarkets) ? [...account.adminMarkets] : [];
      customer.firstName ||= firstText(account.firstName);
      customer.lastName ||= firstText(account.lastName);
      keyByAccountId.set(account.id, key);
      const accountEmail = normalizeEmail(account.email);
      if (accountEmail) keyByEmail.set(accountEmail, key);
      customer.email ||= account.email;
    }

    if (email) {
      keyByEmail.set(email, key);
      customer.email ||= displayEmail;
    }

    return customer;
  };

  const visibleAccounts = scope === null
    ? accounts
    : accounts.filter((account) =>
        Boolean(account.isAdmin) &&
        (account.adminMarkets || []).some((market) => scope.has(market))
      );

  for (const account of visibleAccounts) {
    const email = normalizeEmail(account.email);
    getOrCreateCustomer(account, email, account.email, `account:${account.id}`);
  }

  for (const order of orders) {
    const market = firstText(order.market) || "ro";
    if (scope && !scope.has(market)) continue;

    const shipping = asRecord(order.shippingAddress);
    const billing = asRecord(order.billingAddress);
    const orderEmail = firstText(shipping.email, billing.email, extractGuestEmail(order.notes));
    const normalizedOrderEmail = normalizeEmail(orderEmail);
    const account = (order.userId ? accountsById.get(order.userId) : undefined)
      || (normalizedOrderEmail ? accountsByEmail.get(normalizedOrderEmail) : undefined);
    const normalizedEmail = normalizeEmail(account?.email) || normalizedOrderEmail;
    const displayEmail = account?.email || orderEmail;
    const phone = normalizePhone(firstText(shipping.phone, billing.phone));
    const fallbackKey = normalizedEmail
      ? `email:${normalizedEmail}`
      : phone
        ? `phone:${phone}`
        : `order:${order.id}`;
    const customer = getOrCreateCustomer(account, normalizedEmail, displayEmail, fallbackKey);

    customer.firstName ||= firstText(shipping.firstName, billing.firstName);
    customer.lastName ||= firstText(shipping.lastName, billing.lastName);
    customer.displayName ||= firstText(
      customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : "",
      customer.firstName,
      customer.lastName,
      billing.companyName,
      shipping.companyName,
    );
    customer.markets.add(market);
    customer.orderCount += 1;

    const orderDate = parseOrderDate(order.createdAt);
    const isLaterOrder = orderDate.timestamp !== null
      ? customer.lastOrderTimestamp === null
        || orderDate.timestamp > customer.lastOrderTimestamp
        || (orderDate.timestamp === customer.lastOrderTimestamp && order.id > (customer.lastOrderId || 0))
      : customer.lastOrderTimestamp === null && order.id > (customer.lastOrderId || 0);

    if (isLaterOrder) {
      customer.lastOrderAt = orderDate.value;
      customer.lastOrderTimestamp = orderDate.timestamp;
      customer.lastOrderId = order.id;
    }
  }

  return [...customers.values()]
    .map(({ markets, lastOrderTimestamp: _lastOrderTimestamp, ...customer }) => ({
      ...customer,
      markets: [...markets].sort(),
    }))
    .sort((a, b) => {
      const byDate = (b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0)
        - (a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0);
      if (byDate !== 0) return byDate;
      return (b.lastOrderId || 0) - (a.lastOrderId || 0)
        || a.displayName.localeCompare(b.displayName)
        || a.email.localeCompare(b.email);
    });
}