import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./db";
import {
  orderItems,
  orders,
  productMarkets,
  products,
  users,
} from "@shared/schema";

export const ADMIN_REPORT_PERIODS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

export type AdminReportPeriod = keyof typeof ADMIN_REPORT_PERIODS;

const VALID_MARKETS = new Set(["ro", "fr", "com"]);
const REPORT_PAGE_SIZE = 10;

export function resolveAdminReportPeriod(value: unknown): AdminReportPeriod | null {
  if (value === undefined) return "7d";
  if (
    typeof value !== "string"
    || !Object.prototype.hasOwnProperty.call(ADMIN_REPORT_PERIODS, value)
  ) {
    return null;
  }
  return value as AdminReportPeriod;
}

export type AdminReportMarketScope =
  | { ok: true; requestedMarket: string; markets: string[] | undefined }
  | { ok: false; status: 400 | 403; message: string };

export function resolveAdminReportMarketScope(
  marketParam: unknown,
  isSuperAdmin: boolean,
  allowedMarkets: string[] = [],
): AdminReportMarketScope {
  const requestedMarket = marketParam === undefined || marketParam === null
    ? "all"
    : typeof marketParam === "string"
      ? marketParam.trim().toLowerCase()
      : "";

  if (requestedMarket !== "all" && !VALID_MARKETS.has(requestedMarket)) {
    return { ok: false, status: 400, message: "Invalid market" };
  }

  if (isSuperAdmin) {
    return {
      ok: true,
      requestedMarket,
      markets: requestedMarket === "all" ? undefined : [requestedMarket],
    };
  }

  const normalizedAllowedMarkets = [...new Set(
    allowedMarkets
      .map((market) => market.trim().toLowerCase())
      .filter((market) => VALID_MARKETS.has(market)),
  )];

  if (normalizedAllowedMarkets.length === 0) {
    return { ok: false, status: 403, message: "No markets are assigned to this admin" };
  }

  if (requestedMarket === "all") {
    return {
      ok: true,
      requestedMarket,
      markets: normalizedAllowedMarkets,
    };
  }

  if (!normalizedAllowedMarkets.includes(requestedMarket)) {
    return { ok: false, status: 403, message: "Access denied for this market" };
  }

  return {
    ok: true,
    requestedMarket,
    markets: [requestedMarket],
  };
}

function marketCondition(markets?: string[]) {
  if (!markets) return undefined;

  const conditions = [];
  const nonRomanianMarkets = markets.filter((market) => market !== "ro");
  if (nonRomanianMarkets.length > 0) {
    conditions.push(inArray(orders.market, nonRomanianMarkets));
  }
  if (markets.includes("ro")) {
    // Older Romanian orders may have a null market value; the Admin order
    // list treats those as Romanian orders too.
    conditions.push(or(eq(orders.market, "ro"), isNull(orders.market)));
  }

  if (conditions.length === 0) return sql`false`;
  if (conditions.length === 1) return conditions[0];
  return or(...conditions);
}

function periodCondition(start: Date, end: Date, markets?: string[]) {
  return and(
    gte(orders.createdAt, start),
    lt(orders.createdAt, end),
    marketCondition(markets),
  );
}

export function getAdminDashboardDateWindow(now: Date) {
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const monthStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
  ));

  return { todayStart, monthStart, end: new Date(now) };
}

export function buildAdminDashboardSummary(
  currencyRows: Array<{
    currency: string;
    todayOrderCount: number;
    monthOrderCount: number;
    todaySalesAmount: string;
    monthSalesAmount: string;
  }>,
  newUserCounts: { todayNewUserCount: number; monthNewUserCount: number },
) {
  return {
    currencies: currencyRows
      .map((row) => ({
        currency: row.currency.toUpperCase(),
        todaySalesAmount: row.todaySalesAmount,
        monthSalesAmount: row.monthSalesAmount,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    todayOrderCount: currencyRows.reduce((total, row) => total + row.todayOrderCount, 0),
    monthOrderCount: currencyRows.reduce((total, row) => total + row.monthOrderCount, 0),
    todayNewUserCount: newUserCounts.todayNewUserCount,
    monthNewUserCount: newUserCounts.monthNewUserCount,
  };
}

export async function getAdminDashboardSummary(options: {
  markets?: string[];
  now?: Date;
}) {
  const { todayStart, monthStart, end } = getAdminDashboardDateWindow(options.now ?? new Date());
  const todayExpression = sql`
    ${orders.createdAt} >= ${todayStart}
    AND ${orders.createdAt} < ${end}
  `;
  const monthExpression = sql`
    ${orders.createdAt} >= ${monthStart}
    AND ${orders.createdAt} < ${end}
  `;
  const paidOrderExpression = sql`
    LOWER(${orders.paymentStatus}) = 'paid'
    AND LOWER(${orders.status}) NOT IN ('cancelled', 'refunded')
  `;
  const currencyExpression = sql<string>`UPPER(COALESCE(
    ${orders.currency},
    CASE
      WHEN COALESCE(${orders.market}, 'ro') = 'ro' THEN 'RON'
      ELSE 'EUR'
    END
  ))`;

  const scopedUserIds = options.markets
    ? db.selectDistinct({ userId: orders.userId })
      .from(orders)
      .where(and(
        marketCondition(options.markets),
        sql`${orders.userId} IS NOT NULL`,
      ))
    : undefined;
  const userMarketCondition = scopedUserIds
    ? inArray(users.id, scopedUserIds)
    : undefined;

  const [currencyRows, [newUserCounts]] = await Promise.all([
    db
      .select({
        currency: currencyExpression,
        todayOrderCount: sql<number>`COUNT(*) FILTER (WHERE ${todayExpression})`.mapWith(Number),
        monthOrderCount: sql<number>`COUNT(*) FILTER (WHERE ${monthExpression})`.mapWith(Number),
        todaySalesAmount: sql<string>`
          COALESCE(
            SUM(${orders.totalAmount}::numeric)
              FILTER (WHERE ${todayExpression} AND ${paidOrderExpression}),
            0
          )::text
        `,
        monthSalesAmount: sql<string>`
          COALESCE(
            SUM(${orders.totalAmount}::numeric)
              FILTER (WHERE ${monthExpression} AND ${paidOrderExpression}),
            0
          )::text
        `,
      })
      .from(orders)
      .where(periodCondition(monthStart, end, options.markets))
      .groupBy(currencyExpression),
    db
      .select({
        todayNewUserCount: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${todayStart})`.mapWith(Number),
        monthNewUserCount: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(users)
      .where(and(
        gte(users.createdAt, monthStart),
        lt(users.createdAt, end),
        or(isNull(users.isAdmin), eq(users.isAdmin, false)),
        userMarketCondition,
      )),
  ]);

  return buildAdminDashboardSummary(currencyRows, newUserCounts ?? {
    todayNewUserCount: 0,
    monthNewUserCount: 0,
  });
}

export async function getAdminReportData(options: {
  period: AdminReportPeriod;
  markets?: string[];
  page: number;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const duration = ADMIN_REPORT_PERIODS[options.period];
  const periodStart = new Date(now.getTime() - duration);
  const previousPeriodStart = new Date(now.getTime() - duration * 2);
  const bucketCount = options.period === "24h" ? 24 : options.period === "7d" ? 7 : 30;
  const bucketWidth = duration / bucketCount;
  const currencyExpression = sql<string>`UPPER(COALESCE(${orders.currency}, 'RON'))`;
  const currentPeriodExpression = sql`
    ${orders.createdAt} >= ${periodStart}
    AND ${orders.createdAt} < ${now}
  `;
  const previousPeriodExpression = sql`
    ${orders.createdAt} >= ${previousPeriodStart}
    AND ${orders.createdAt} < ${periodStart}
  `;
  const paidOrderExpression = sql`
    LOWER(${orders.paymentStatus}) = 'paid'
    AND LOWER(${orders.status}) NOT IN ('cancelled', 'refunded')
  `;

  const currencyRows = await db
    .select({
      currency: currencyExpression,
      currentOrderCount: sql<number>`
        COUNT(*) FILTER (WHERE ${currentPeriodExpression})
      `.mapWith(Number),
      previousOrderCount: sql<number>`
        COUNT(*) FILTER (WHERE ${previousPeriodExpression})
      `.mapWith(Number),
      currentPaidOrderCount: sql<number>`
        COUNT(*) FILTER (
          WHERE ${currentPeriodExpression} AND ${paidOrderExpression}
        )
      `.mapWith(Number),
      previousPaidOrderCount: sql<number>`
        COUNT(*) FILTER (
          WHERE ${previousPeriodExpression} AND ${paidOrderExpression}
        )
      `.mapWith(Number),
      currentPaidSalesAmount: sql<string>`
        COALESCE(
          SUM(${orders.totalAmount}::numeric)
            FILTER (WHERE ${currentPeriodExpression} AND ${paidOrderExpression}),
          0
        )::text
      `,
      previousPaidSalesAmount: sql<string>`
        COALESCE(
          SUM(${orders.totalAmount}::numeric)
            FILTER (WHERE ${previousPeriodExpression} AND ${paidOrderExpression}),
          0
        )::text
      `,
    })
    .from(orders)
    .where(periodCondition(previousPeriodStart, now, options.markets))
    .groupBy(currencyExpression);

  const orderCount = currencyRows.reduce((total, row) => total + row.currentOrderCount, 0);
  const pageCount = Math.max(1, Math.ceil(orderCount / REPORT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(options.page)), pageCount);
  const offset = (page - 1) * REPORT_PAGE_SIZE;

  const marketExpression = sql<string>`COALESCE(${orders.market}, 'ro')`;
  const marketBreakdown = await db
    .select({
      market: marketExpression,
      orderCount: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(orders)
    .where(periodCondition(periodStart, now, options.markets))
    .groupBy(marketExpression)
    .orderBy(desc(sql`COUNT(*)`));

  const bucketExpression = sql<number>`
    FLOOR(
      (EXTRACT(EPOCH FROM ${orders.createdAt}) * 1000 - ${periodStart.getTime()})
      / ${bucketWidth}
    )
  `;
  const trendRows = await db
    .select({
      bucketIndex: bucketExpression.mapWith(Number),
      orderCount: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(orders)
    .where(periodCondition(periodStart, now, options.markets))
    // The same parameterized SQL fragment gets different placeholders each
    // time Drizzle renders it. Use the selected bucket's ordinal so PostgreSQL
    // groups by the exact selected expression instead of treating it as new.
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1"));
  const trendCounts = new Map(trendRows.map((row) => [row.bucketIndex, row.orderCount]));
  const chartBuckets = Array.from({ length: bucketCount }, (_, index) => ({
    startAt: new Date(periodStart.getTime() + index * bucketWidth).toISOString(),
    orderCount: trendCounts.get(index) ?? 0,
  }));

  const customerNameExpression = sql<string>`
    COALESCE(
      NULLIF(
        TRIM(CONCAT_WS(
          ' ',
          ${orders.shippingAddress} ->> 'firstName',
          ${orders.shippingAddress} ->> 'lastName'
        )),
        ''
      ),
      NULLIF(${orders.billingAddress} ->> 'companyName', ''),
      NULLIF(${orders.shippingAddress} ->> 'companyName', ''),
      ''
    )
  `;
  const reportOrders = await db
    .select({
      id: orders.id,
      publicOrderRef: orders.publicOrderRef,
      userId: orders.userId,
      market: marketExpression,
      currency: currencyExpression,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
      customerName: customerNameExpression,
      itemCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${orderItems}
        WHERE ${orderItems.orderId} = ${orders.id}
      )`.mapWith(Number),
    })
    .from(orders)
    .where(periodCondition(periodStart, now, options.markets))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(REPORT_PAGE_SIZE)
    .offset(offset);

  const productScope = options.markets
    ? inArray(productMarkets.market, options.markets)
    : undefined;
  const [productCountRow] = await db
    .select({
      activeProductCount: sql<number>`
        COUNT(DISTINCT ${productMarkets.productId})
      `.mapWith(Number),
    })
    .from(productMarkets)
    .innerJoin(products, eq(products.id, productMarkets.productId))
    .where(and(
      eq(productMarkets.isActive, true),
      eq(products.status, "active"),
      productScope,
    ));
  const dashboardSummary = await getAdminDashboardSummary({
    markets: options.markets,
    now,
  });

  return {
    period: options.period,
    markets: options.markets ?? ["ro", "fr", "com"],
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    previousPeriodStart: previousPeriodStart.toISOString(),
    page,
    pageSize: REPORT_PAGE_SIZE,
    pageCount,
    orderCount,
    activeProductCount: productCountRow?.activeProductCount ?? 0,
    dashboardSummary,
    currencies: currencyRows.map((row) => ({
      ...row,
      currency: row.currency || "RON",
    })),
    marketBreakdown,
    chartBuckets,
    orders: reportOrders,
  };
}