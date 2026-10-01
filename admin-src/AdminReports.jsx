import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Globe2,
  Package,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

const RANGE_KEYS = {
  "24h": "reports.period24h",
  "7d": "reports.period7d",
  "30d": "reports.period30d",
};

const MARKET_LABEL_KEYS = {
  ro: "reports.marketRomania",
  fr: "reports.marketFrance",
  com: "reports.marketInternational",
};

const MARKET_CURRENCY = { ro: "RON", fr: "EUR", com: "EUR" };

const ORDER_STATUS_KEYS = {
  pending: "reports.statusPending",
  accepted: "reports.statusAccepted",
  processing: "reports.statusProcessing",
  shipped: "reports.statusShipped",
  in_delivery: "reports.statusInDelivery",
  delivered: "reports.statusDelivered",
  cancelled: "reports.statusCancelled",
  manual_processing: "reports.statusManualProcessing",
  manual_failed: "reports.statusManualFailed",
};

function localeFor(language) {
  if (language?.startsWith("fr")) return "fr-FR";
  if (language?.startsWith("en")) return "en-GB";
  return "ro-RO";
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(numberValue(value));
}

function formatMoney(value, currency, locale) {
  const amount = numberValue(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)} ${currency || ""}`.trim();
  }
}

function changePercent(current, previous) {
  const previousValue = numberValue(previous);
  if (previousValue <= 0) return null;
  return ((numberValue(current) - previousValue) / previousValue) * 100;
}

function formatPercent(value, locale) {
  const rounded = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${rounded}%`;
}

function StatCard({ label, value, detail, change, icon: Icon, highlight = false }) {
  return (
    <article className={`admin-stat-card${highlight ? " is-highlight" : ""}`}>
      <div className="admin-stat-heading">
        <span>{label}</span>
        <Icon size={15} aria-hidden="true" />
      </div>
      <strong className={`admin-stat-value${value.includes("\n") ? " is-multiline" : ""}`}>
        {value.split("\n").map((line, index) => (
          <span key={`${line}-${index}`}>{line}</span>
        ))}
      </strong>
      <div className="admin-stat-foot">
        {change ? (
          <strong className={change.startsWith("−") ? "is-negative" : ""}>
            {change.startsWith("−") ? <ArrowDownRight size={11} aria-hidden="true" /> : <ArrowUpRight size={11} aria-hidden="true" />}
            {change}
          </strong>
        ) : null}
        <span>{detail}</span>
      </div>
    </article>
  );
}

function marketLabel(market, t) {
  return MARKET_LABEL_KEYS[market] ? t(MARKET_LABEL_KEYS[market]) : market.toUpperCase();
}

function orderStatus(order, t) {
  const status = String(order.status || "").toLowerCase();
  const statusKey = ORDER_STATUS_KEYS[status];
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  if (statusKey) return { label: t(statusKey), tone: status };
  if (paymentStatus === "paid") return { label: t("reports.statusPaid"), tone: "paid" };
  if (["failed", "error"].includes(paymentStatus)) {
    return { label: t("reports.statusPaymentFailed"), tone: "manual_failed" };
  }
  if (["pending", "unpaid", "awaiting_payment"].includes(paymentStatus)) {
    return { label: t("reports.statusUnpaid"), tone: "pending" };
  }
  return { label: t("reports.statusUnknown"), tone: "archived" };
}

function formatOrderDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ReportOrderTable({
  data,
  page,
  locale,
  market,
  t,
  formatOrderAmount,
  onOpenOrder,
  onNavigateToOrders,
  onPageChange,
  loading,
}) {
  const rows = data?.orders || [];
  const pageCount = Math.max(1, numberValue(data?.pageCount));
  const activePage = Math.min(Math.max(1, numberValue(data?.page) || page), pageCount);
  const totalOrders = numberValue(data?.orderCount);
  const isEmpty = totalOrders === 0;

  return (
    <section className="admin-panel admin-table-panel admin-report-orders">
      <header className="admin-panel-heading">
        <div>
          <h2>{t("reports.ordersTitle")}</h2>
          <p>{t("reports.ordersSubtitle")}</p>
        </div>
        <div className="admin-report-table-heading-actions">
          <span className="admin-report-table-count">
            {t("reports.resultCount", { count: formatNumber(totalOrders, locale) })}
          </span>
          <button className="admin-report-text-button" type="button" onClick={onNavigateToOrders}>
            {t("nav.orders")} <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isEmpty ? (
        <div className="admin-table-empty">{t("reports.emptyOrders")}</div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-data-table admin-report-data-table">
              <thead>
                <tr>
                  <th>{t("reports.tableOrder")}</th>
                  <th>{t("reports.tableCustomer")}</th>
                  <th>{t("reports.tableMarket")}</th>
                  <th>{t("reports.tableItems")}</th>
                  <th>{t("reports.tableAmount")}</th>
                  <th>{t("reports.tableStatus")}</th>
                  <th><span className="admin-report-sr-only">{t("reports.tableAction")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const status = orderStatus(order, t);
                  const tone = status.tone === "pending" || status.tone === "manual_processing"
                    ? "is-pending"
                    : ["processing", "accepted", "in_delivery"].includes(status.tone)
                      ? "is-processing"
                      : ["cancelled", "manual_failed", "archived"].includes(status.tone)
                        ? "is-archived"
                        : "";
                  const displayOrderId = order.publicOrderRef || `#${order.id}`;
                  const customer = String(order.customerName || "").trim()
                    || (order.userId ? `#${order.userId}` : t("reports.guest"));

                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="admin-table-primary">{displayOrderId}</span>
                        <span className="admin-table-secondary"> · {formatOrderDate(order.createdAt, locale)}</span>
                      </td>
                      <td>{customer || t("reports.customerUnknown")}</td>
                      <td>
                        <span className="admin-market-code">{order.market === "com" ? ".COM" : String(order.market || market).toUpperCase()}</span>
                      </td>
                      <td>{formatNumber(order.itemCount, locale)}</td>
                      <td className="admin-table-primary">{formatOrderAmount(order)}</td>
                      <td><span className={`admin-status${tone ? ` ${tone}` : ""}`}>{status.label}</span></td>
                      <td>
                        <button
                          className="admin-table-action"
                          type="button"
                          aria-label={t("reports.viewOrder", { id: displayOrderId })}
                          title={t("reports.viewOrder", { id: displayOrderId })}
                          onClick={() => onOpenOrder(order)}
                        >
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="admin-report-pagination">
            <span>
              {t("reports.pagination", {
                page: formatNumber(activePage, locale),
                count: formatNumber(pageCount, locale),
              })}
            </span>
            <div className="admin-report-pagination-actions">
              <button
                type="button"
                aria-label={t("reports.firstPage")}
                title={t("reports.firstPage")}
                disabled={loading || activePage <= 1}
                onClick={() => onPageChange(1)}
              >
                <ChevronsLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("reports.previousPage")}
                title={t("reports.previousPage")}
                disabled={loading || activePage <= 1}
                onClick={() => onPageChange(activePage - 1)}
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("reports.nextPage")}
                title={t("reports.nextPage")}
                disabled={loading || activePage >= pageCount}
                onClick={() => onPageChange(activePage + 1)}
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("reports.lastPage")}
                title={t("reports.lastPage")}
                disabled={loading || activePage >= pageCount}
                onClick={() => onPageChange(pageCount)}
              >
                <ChevronsRight size={14} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

export default function AdminReports({
  data,
  loading,
  error,
  embedded = false,
  period,
  page,
  market,
  locale: language,
  t,
  formatOrderAmount,
  onPeriodChange,
  onPageChange,
  onRefresh,
  onRetry,
  onOpenOrder,
  onNavigateToOrders,
}) {
  const locale = localeFor(language);
  const periodLabel = t(RANGE_KEYS[period] || RANGE_KEYS["7d"]);
  const marketName = market === "all" ? t("reports.allMarkets") : marketLabel(market, t);
  const currencies = data?.currencies || [];
  const markets = data?.markets || (market === "all" ? ["ro", "fr", "com"] : [market]);
  const defaultCurrencies = [...new Set(markets.map((item) => MARKET_CURRENCY[item]).filter(Boolean))];
  const visibleCurrencies = currencies.filter((row) =>
    numberValue(row.currentPaidSalesAmount) !== 0
    || numberValue(row.previousPaidSalesAmount) !== 0
    || numberValue(row.currentPaidOrderCount) > 0
    || numberValue(row.previousPaidOrderCount) > 0
  );
  const currencyRows = visibleCurrencies.length
    ? visibleCurrencies
    : defaultCurrencies.map((currency) => ({
        currency,
        currentPaidSalesAmount: "0",
        previousPaidSalesAmount: "0",
        currentPaidOrderCount: 0,
        previousPaidOrderCount: 0,
      }));

  const currentOrderCount = numberValue(data?.orderCount);
  const salesValue = currencyRows.length
    ? currencyRows.map((row) => formatMoney(row.currentPaidSalesAmount, row.currency, locale)).join("\n")
    : "—";
  const avgRows = currencyRows
    .filter((row) => numberValue(row.currentPaidOrderCount) > 0)
    .map((row) => ({
      currency: row.currency,
      average: numberValue(row.currentPaidSalesAmount) / numberValue(row.currentPaidOrderCount),
    }));
  const averageValue = avgRows.length
    ? avgRows.map((row) => formatMoney(row.average, row.currency, locale)).join("\n")
    : "—";
  const salesChanges = currencyRows
    .map((row) => {
      const delta = changePercent(row.currentPaidSalesAmount, row.previousPaidSalesAmount);
      return delta === null ? null : `${row.currency} ${formatPercent(delta, locale)}`;
    })
    .filter(Boolean);
  const salesChange = salesChanges.length > 0
    ? salesChanges.join(" · ")
    : null;

  const currentPaidOrders = currencyRows.reduce((sum, row) => sum + numberValue(row.currentPaidOrderCount), 0);
  const previousPaidOrders = currencyRows.reduce((sum, row) => sum + numberValue(row.previousPaidOrderCount), 0);
  const previousOrders = currencies.reduce((sum, row) => sum + numberValue(row.previousOrderCount), 0);
  const previousAverageByCurrency = currencyRows
    .map((row) => ({
      currency: row.currency,
      currentAverage: numberValue(row.currentPaidOrderCount) > 0
        ? numberValue(row.currentPaidSalesAmount) / numberValue(row.currentPaidOrderCount)
        : 0,
      previousAverage: numberValue(row.previousPaidOrderCount) > 0
        ? numberValue(row.previousPaidSalesAmount) / numberValue(row.previousPaidOrderCount)
        : 0,
    }))
    .filter((row) => row.previousAverage > 0);
  const averageChanges = previousAverageByCurrency
    .map((row) => {
      const delta = changePercent(row.currentAverage, row.previousAverage);
      return delta === null ? null : `${row.currency} ${formatPercent(delta, locale)}`;
    })
    .filter(Boolean);
  const averageChange = averageChanges.length > 0
    ? averageChanges.join(" · ")
    : null;
  const orderChange = changePercent(currentOrderCount, previousOrders);
  const salesDetail = salesChange
    ? t("reports.previousPeriod")
    : currentPaidOrders > 0
      ? t("reports.noPreviousData")
      : t("reports.noPaidSales");
  const averageDetail = averageChange
    ? t("reports.previousPeriod")
    : previousPaidOrders > 0
      ? t("reports.noPreviousData")
      : t("reports.noPaidSales");
  const chartBuckets = data?.chartBuckets || [];
  const maximumOrders = Math.max(1, ...chartBuckets.map((bucket) => numberValue(bucket.orderCount)));
  const labelEvery = period === "7d" ? 1 : Math.max(1, Math.ceil(chartBuckets.length / 6));
  const marketBreakdown = (data?.marketBreakdown || []).filter((item) => numberValue(item.orderCount) > 0);
  const chartDateFormatter = new Intl.DateTimeFormat(locale, period === "24h"
    ? { hour: "2-digit" }
    : { day: "2-digit", month: "short" });
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: period === "24h" ? "short" : undefined,
  });
  const currencyTotalCount = marketBreakdown.reduce((sum, item) => sum + numberValue(item.orderCount), 0);

  return (
    <div className={`admin-reports-page${embedded ? " is-embedded" : ""}`} aria-busy={loading}>
      <div className={`admin-reports-page-heading${embedded ? " is-embedded" : ""}`}>
        <div>
          <div className="admin-reports-eyebrow">{t("reports.marketScope")}</div>
          {embedded
            ? <h2>{t("reports.dashboardHeading")}</h2>
            : <h1>{t("reports.title")}</h1>}
          <p>{t("reports.description")}</p>
        </div>
        <div className="admin-reports-page-actions">
          <span className="admin-report-scope">
            <Globe2 size={14} aria-hidden="true" />
            {marketName}
          </span>
          <button className="admin-report-refresh" type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? "is-spinning" : ""} size={14} aria-hidden="true" />
            {t("reports.refresh")}
          </button>
        </div>
      </div>

      <div className="admin-content-toolbar admin-report-toolbar">
        <div className="admin-report-range" role="group" aria-label={t("reports.periodGroup")}>
          {Object.keys(RANGE_KEYS).map((range) => (
            <button
              key={range}
              className={period === range ? "is-active" : ""}
              type="button"
              aria-pressed={period === range}
              onClick={() => onPeriodChange(range)}
            >
              {t(RANGE_KEYS[range])}
            </button>
          ))}
        </div>
        <span className="admin-report-scope">
          <CalendarDays size={13} aria-hidden="true" />
          {periodLabel}
        </span>
      </div>

      {error ? (
        <div className="admin-report-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>{t("reports.retry")}</button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="admin-report-loading" role="status" aria-live="polite">
          <span className="admin-report-spinner" aria-hidden="true" />
          {t("reports.loading")}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="admin-dashboard-grid admin-report-stat-grid">
            <StatCard
              label={t("reports.paidSales")}
              value={salesValue}
              detail={salesDetail}
              change={salesChange}
              icon={Activity}
              highlight
            />
            <StatCard
              label={t("reports.orderCount")}
              value={formatNumber(currentOrderCount, locale)}
              detail={t("reports.previousPeriod")}
              change={orderChange === null ? null : formatPercent(orderChange, locale)}
              icon={ShoppingCart}
            />
            <StatCard
              label={t("reports.averageOrderValue")}
              value={averageValue}
              detail={averageDetail}
              change={averageChange}
              icon={ArrowDownRight}
            />
            <StatCard
              label={t("reports.activeProducts")}
              value={formatNumber(data.activeProductCount, locale)}
              detail={t("reports.currentCatalog")}
              icon={Package}
            />
          </div>

          <div className="admin-report-grid">
            <section className="admin-panel admin-report-chart-panel">
              <header className="admin-panel-heading">
                <div>
                  <h2>{t("reports.chartTitle")}</h2>
                  <p>{t("reports.chartSubtitle", { period: periodLabel })}</p>
                </div>
                <span className="admin-report-period-label">
                  <CalendarDays size={12} aria-hidden="true" />
                  {periodLabel}
                  <ChevronDown size={11} aria-hidden="true" />
                </span>
              </header>
              <div className="admin-chart-wrap">
                <div className="admin-chart-summary">
                  <strong>{formatNumber(currentOrderCount, locale)}</strong>
                  <span>{t("reports.chartSummary", { market: marketName })}</span>
                </div>
                <div className="admin-chart" role="img" aria-label={t("reports.chartAccessible", { period: periodLabel })}>
                  {chartBuckets.map((bucket, index) => {
                    const count = numberValue(bucket.orderCount);
                    const height = count > 0 ? Math.max(6, (count / maximumOrders) * 100) : 3;
                    const date = new Date(bucket.startAt);
                    return (
                      <div
                        className={`admin-chart-bar${index === chartBuckets.length - 1 ? " is-current" : ""}`}
                        key={`${bucket.startAt}-${index}`}
                        title={`${fullDateFormatter.format(date)} · ${formatNumber(count, locale)}`}
                      >
                        <span style={{ height: `${height}%` }} />
                        {index % labelEvery === 0 || index === chartBuckets.length - 1
                          ? <label>{chartDateFormatter.format(date)}</label>
                          : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="admin-panel admin-report-market-panel">
              <header className="admin-panel-heading">
                <div>
                  <h2>{t("reports.marketDistribution")}</h2>
                  <p>{t("reports.marketSubtitle")}</p>
                </div>
                <span className="admin-report-market-total">{formatNumber(currencyTotalCount, locale)}</span>
              </header>
              {marketBreakdown.length ? (
                <div className="admin-report-market-list">
                  {marketBreakdown.map((item) => {
                    const count = numberValue(item.orderCount);
                    const share = currencyTotalCount ? Math.round((count / currencyTotalCount) * 100) : 0;
                    return (
                      <div className="admin-report-market-row" key={item.market}>
                        <div className="admin-report-market-copy">
                          <span className="admin-market-code">{item.market === "com" ? ".COM" : item.market.toUpperCase()}</span>
                          <strong>{marketLabel(item.market, t)}</strong>
                          <span>{t("reports.marketOrderShare", { count: formatNumber(count, locale), share })}</span>
                        </div>
                        <div
                          className="admin-report-market-track"
                          role="img"
                          aria-label={t("reports.marketOrderShare", { count: formatNumber(count, locale), share })}
                        >
                          <span style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-table-empty">{t("reports.emptyOrders")}</div>
              )}
              <div className="admin-report-market-foot">
                <span>{t("reports.activeMarket")}</span>
                <strong>{marketName}</strong>
              </div>
            </section>
          </div>

          <ReportOrderTable
            data={data}
            page={page}
            locale={locale}
            market={market}
            t={t}
            formatOrderAmount={formatOrderAmount}
            onOpenOrder={onOpenOrder}
            onNavigateToOrders={onNavigateToOrders}
            onPageChange={onPageChange}
            loading={loading}
          />
        </>
      ) : null}
    </div>
  );
}