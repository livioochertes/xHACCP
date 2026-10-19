import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock3, RefreshCw, ShoppingBasket } from "lucide-react";

const marketLabel = { ro: "România · .ro", fr: "France · .fr", com: "International · .com" };
const statusColors = {
  sent: { color: "#176b50", background: "#e8f4ee" },
  pending: { color: "#755d32", background: "#f6f1e5" },
  retryable: { color: "#755d32", background: "#f6f1e5" },
  sending: { color: "#365b8a", background: "#eef4fb" },
  failed: { color: "#a34337", background: "#fbefec" },
  unknown: { color: "#755d32", background: "#f6f1e5" },
};
const PAGE_SIZE = 50;

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AbandonedCarts({ token, market, t, locale = "en" }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        market: market || "all",
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const response = await fetch(`/admin/api/cart-abandonment?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json();
      setCarts(Array.isArray(result.carts) ? result.carts : []);
      setTotal(Number(result.total) || 0);
      if (page > 0 && page * PAGE_SIZE >= Number(result.total || 0)) {
        setPage(Math.max(0, Math.ceil(Number(result.total || 0) / PAGE_SIZE) - 1));
      }
    } catch (err) {
      setError(err.message === "401" || err.message === "403"
        ? t("cartAbandonment.errorAuth")
        : t("cartAbandonment.errorLoad"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [market, page, token, t]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main style={{ background: "#fff", padding: 24, borderRadius: 10, boxShadow: "0 2px 9px rgba(15,23,42,.08)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, color: "#1e293b", fontSize: 22 }}>{t("cartAbandonment.title")}</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>{t("cartAbandonment.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void load({ quiet: true })}
          disabled={loading || refreshing}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 13px", border: "1px solid #cbd5e1", borderRadius: 7, background: "white", color: "#334155", cursor: loading || refreshing ? "wait" : "pointer", fontWeight: 600 }}
        >
          <RefreshCw size={15} /> {refreshing ? t("cartAbandonment.refreshing") : t("cartAbandonment.refresh")}
        </button>
      </header>

      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: 12, marginBottom: 16, background: "#f0f7fb", border: "1px solid #d2e5ee", borderRadius: 8, color: "#35566a", fontSize: 12, lineHeight: 1.5 }}>
        <AlertTriangle size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span>{t("cartAbandonment.privacyNotice")}</span>
      </div>

      {error && <div role="alert" style={{ padding: 12, marginBottom: 14, borderRadius: 7, background: "#fbefec", color: "#873c32" }}>{error}</div>}
      {loading ? (
        <div role="status" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>{t("cartAbandonment.loading")}</div>
      ) : carts.length === 0 ? (
        <div style={{ padding: "34px 15px", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 9 }}>
          <ShoppingBasket size={25} style={{ marginBottom: 8, color: "#94a3b8" }} />
          <div>{t("cartAbandonment.empty")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {carts.map(cart => {
            const status = statusColors[cart.alertStatus] ? cart.alertStatus : "unknown";
            return (
              <article key={cart.id} style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: 15 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ color: "#1e293b" }}>{marketLabel[cart.market] || cart.market}</strong>
                    <span style={{ marginLeft: 9, color: "#64748b", fontSize: 12 }}>
                      {cart.accountType === "account" ? t("cartAbandonment.account") : t("cartAbandonment.anonymous")}
                    </span>
                  </div>
                  <span style={{ borderRadius: 20, padding: "4px 9px", fontSize: 11, fontWeight: 700, color: statusColors[status].color, background: statusColors[status].background }}>
                    {t(`cartAbandonment.status.${status}`)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0", color: "#64748b", fontSize: 12 }}>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><Clock3 size={13} />{t("cartAbandonment.lastActivity")}: {formatDate(cart.cartUpdatedAt, locale)}</span>
                  <span>{t("cartAbandonment.abandonedAt")}: {formatDate(cart.abandonedAt, locale)}</span>
                </div>

                <ul style={{ margin: 0, paddingLeft: 20, color: "#334155", fontSize: 13, lineHeight: 1.6 }}>
                  {(cart.items || []).map(item => (
                    <li key={`${item.productId}-${item.quantity}`}>
                      {item.productName} × {item.quantity}
                      {item.components?.length > 0 && (
                        <span style={{ color: "#64748b" }}> · {item.components.map(part => `${part.name} × ${part.quantity}`).join(", ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {cart.alertError && <div style={{ marginTop: 9, color: "#9a4d3d", fontSize: 11 }}>{t("cartAbandonment.alertIssue")}: {cart.alertError}</div>}
                <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
                  {t("cartAbandonment.expiry")}: {formatDate(cart.expiresAt, locale)}
                </div>
              </article>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
            <span>{t("cartAbandonment.showing", { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, total), total })}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))} style={pageButtonStyle}>{t("cartAbandonment.previous")}</button>
              <button type="button" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(current => current + 1)} style={pageButtonStyle}>{t("cartAbandonment.next")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const pageButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "white",
  color: "#334155",
  padding: "7px 10px",
  cursor: "pointer",
};
