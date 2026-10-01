import React, { useEffect, useMemo, useState } from "react";

const MARKET_CODES = ["ro", "fr", "com"];

function emptyForm() {
  return { productIds: [], startsAt: "", endsAt: "" };
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateTimeLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "";
}

function normalizedPriority(product) {
  const priority = Number(product?.priority);
  return Number.isFinite(priority) && priority > 0 ? priority : Number.POSITIVE_INFINITY;
}

function getCampaignProductEntries(campaign, productById) {
  return (Array.isArray(campaign.productIds) ? campaign.productIds : [])
    .map((id, index) => ({ id, index, product: productById.get(String(id)) }))
    .sort((a, b) =>
      Number(Boolean(b.product?.featured)) - Number(Boolean(a.product?.featured))
      || normalizedPriority(a.product) - normalizedPriority(b.product)
      || a.index - b.index,
    );
}

export default function AIRecommendationCampaigns({
  t,
  allowedMarkets,
  selectedMarketTab,
}) {
  const marketOptions = (allowedMarkets || MARKET_CODES)
    .filter((market) => MARKET_CODES.includes(market));
  const marketOptionsKey = marketOptions.join(",");
  const initialMarket = selectedMarketTab !== "all" && marketOptions.includes(selectedMarketTab)
    ? selectedMarketTab
    : marketOptions[0] || "ro";
  const [market, setMarket] = useState(initialMarket);
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (selectedMarketTab !== "all" && marketOptions.includes(selectedMarketTab)) {
      setMarket(selectedMarketTab);
    } else if (!marketOptions.includes(market)) {
      setMarket(marketOptions[0] || "ro");
    }
  }, [selectedMarketTab, marketOptionsKey]);

  const productById = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products],
  );

  const loadCampaigns = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(
        `/admin/api/ai-recommendation-campaigns?market=${encodeURIComponent(market)}`,
        { headers: { Authorization: `Bearer ${token || ""}` } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || t("aiRecommendations.loadFailed"));
      }
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (loadError) {
      setError(loadError.message || t("aiRecommendations.loadFailed"));
      setCampaigns([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(emptyForm());
    setEditingId(null);
    setFeedback("");
    loadCampaigns();
  }, [market]);

  const startNewCampaign = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setFeedback("");
  };

  const editCampaign = (campaign) => {
    setEditingId(campaign.id);
    setForm({
      productIds: Array.isArray(campaign.productIds)
        ? campaign.productIds.map(String)
        : [],
      startsAt: toLocalDateTimeInput(campaign.startsAt),
      endsAt: toLocalDateTimeInput(campaign.endsAt),
    });
    setError("");
    setFeedback("");
  };

  const updateProductSlot = (slot, productId) => {
    setForm((current) => {
      const productIds = [...current.productIds];
      while (productIds.length <= slot) productIds.push("");
      productIds[slot] = productId;
      return { ...current, productIds };
    });
  };

  const saveCampaign = async (event) => {
    event.preventDefault();
    setError("");
    setFeedback("");

    const productIds = form.productIds.map((id) => id.trim()).filter(Boolean);
    if (!form.startsAt || !form.endsAt) {
      setError(t("aiRecommendations.dateRequired"));
      return;
    }
    if (productIds.length < 2 || productIds.length > 3) {
      setError(t("aiRecommendations.productRequired"));
      return;
    }
    if (new Set(productIds).size !== productIds.length) {
      setError(t("aiRecommendations.productRequired"));
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(
        editingId
          ? `/admin/api/ai-recommendation-campaigns/${editingId}`
          : "/admin/api/ai-recommendation-campaigns",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token || ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            market,
            productIds: productIds.map(Number),
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(form.endsAt).toISOString(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(t("aiRecommendations.conflictError"));
        }
        throw new Error(data.message || t("aiRecommendations.saveFailed"));
      }
      setFeedback(t(editingId ? "aiRecommendations.updated" : "aiRecommendations.created"));
      setEditingId(null);
      setForm(emptyForm());
      await loadCampaigns();
    } catch (saveError) {
      setError(saveError.message || t("aiRecommendations.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(t("aiRecommendations.deleteConfirm"))) return;
    setDeletingId(campaign.id);
    setError("");
    setFeedback("");
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/admin/api/ai-recommendation-campaigns/${campaign.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || t("aiRecommendations.deleteFailed"));
      }
      if (editingId === campaign.id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setFeedback(t("aiRecommendations.deleted"));
      await loadCampaigns();
    } catch (deleteError) {
      setError(deleteError.message || t("aiRecommendations.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const fieldStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #ced4da",
    borderRadius: "6px",
    padding: "9px 10px",
    background: "white",
    color: "#172b4d",
  };
  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#344563",
    marginBottom: "6px",
  };
  const primaryButtonStyle = {
    border: 0,
    borderRadius: "6px",
    padding: "9px 14px",
    background: "#0d6efd",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  };
  const secondaryButtonStyle = {
    border: "1px solid #ced4da",
    borderRadius: "6px",
    padding: "8px 12px",
    background: "white",
    color: "#344563",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div className="container">
      <section style={{ background: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: "0 0 7px", color: "#172b4d" }}>{t("aiRecommendations.title")}</h2>
            <p style={{ margin: 0, color: "#6c757d" }}>{t("aiRecommendations.description")}</p>
          </div>
          <button type="button" onClick={loadCampaigns} disabled={loading} style={secondaryButtonStyle}>
            {loading ? t("aiRecommendations.loading") : `↻ ${t("aiRecommendations.reload")}`}
          </button>
        </div>

        <div style={{ maxWidth: "260px", marginBottom: "20px" }}>
          <label htmlFor="ai-recommendation-market" style={labelStyle}>{t("aiRecommendations.market")}</label>
          <select
            id="ai-recommendation-market"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            style={fieldStyle}
          >
            {marketOptions.map((option) => (
              <option value={option} key={option}>.{option}</option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" style={{ padding: "10px 12px", marginBottom: "14px", borderRadius: "6px", color: "#842029", background: "#f8d7da" }}>
            {error}
          </div>
        )}
        {feedback && (
          <div role="status" style={{ padding: "10px 12px", marginBottom: "14px", borderRadius: "6px", color: "#0f5132", background: "#d1e7dd" }}>
            {feedback}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
          <section style={{ border: "1px solid #dee2e6", borderRadius: "8px", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, color: "#172b4d" }}>{t("aiRecommendations.formTitle")}</h3>
              {editingId && (
                <button type="button" onClick={startNewCampaign} style={secondaryButtonStyle}>
                  {t("aiRecommendations.newCampaign")}
                </button>
              )}
            </div>
            <form onSubmit={saveCampaign}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label htmlFor="ai-campaign-start" style={labelStyle}>{t("aiRecommendations.startsAt")}</label>
                  <input
                    id="ai-campaign-start"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                    required
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label htmlFor="ai-campaign-end" style={labelStyle}>{t("aiRecommendations.endsAt")}</label>
                  <input
                    id="ai-campaign-end"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                    required
                    style={fieldStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <div style={{ ...labelStyle, marginBottom: "8px" }}>{t("aiRecommendations.products")}</div>
                {[0, 1, 2].map((slot) => {
                  const selectedId = form.productIds[slot] || "";
                  const selectedElsewhere = new Set(
                    form.productIds.filter((id, index) => index !== slot && id),
                  );
                  return (
                    <label key={slot} style={{ display: "block", marginBottom: "9px" }}>
                      <span style={{ display: "block", fontSize: "12px", color: "#6c757d", marginBottom: "4px" }}>
                        {t("aiRecommendations.productSlot", { number: slot + 1 })}
                      </span>
                      <select
                        value={selectedId}
                        onChange={(event) => updateProductSlot(slot, event.target.value)}
                        style={fieldStyle}
                      >
                        <option value="">{t("aiRecommendations.selectProduct")}</option>
                        {products.map((product) => {
                          const productId = String(product.id);
                          const priority = normalizedPriority(product);
                          const badges = [
                            product.featured ? t("aiRecommendations.featuredBadge") : "",
                            Number.isFinite(priority)
                              ? t("aiRecommendations.priorityBadge", { priority })
                              : "",
                          ].filter(Boolean);
                          return (
                            <option
                              key={product.id}
                              value={productId}
                              disabled={selectedElsewhere.has(productId)}
                            >
                              {product.name}{badges.length ? ` — ${badges.join(" · ")}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  );
                })}
                <p style={{ margin: "5px 0 0", fontSize: "12px", lineHeight: 1.5, color: "#6c757d" }}>
                  {t("aiRecommendations.priorityHint")}
                </p>
                {products.length === 0 && !loading && (
                  <p style={{ margin: "10px 0 0", color: "#856404", fontSize: "13px" }}>
                    {t("aiRecommendations.emptyProducts")}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="submit" disabled={saving || loading || products.length === 0} style={primaryButtonStyle}>
                  {saving ? t("aiRecommendations.saving") : t("aiRecommendations.save")}
                </button>
                {editingId && (
                  <button type="button" onClick={startNewCampaign} disabled={saving} style={secondaryButtonStyle}>
                    {t("aiRecommendations.cancel")}
                  </button>
                )}
              </div>
            </form>
          </section>

          <section style={{ border: "1px solid #dee2e6", borderRadius: "8px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 14px", color: "#172b4d" }}>{t("aiRecommendations.title")}</h3>
            {loading ? (
              <p style={{ color: "#6c757d" }}>{t("aiRecommendations.loading")}</p>
            ) : campaigns.length === 0 ? (
              <p style={{ color: "#6c757d" }}>{t("aiRecommendations.noCampaigns")}</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {campaigns.map((campaign) => {
                  const now = Date.now();
                  const startsAt = new Date(campaign.startsAt).getTime();
                  const endsAt = new Date(campaign.endsAt).getTime();
                  const status = startsAt <= now && endsAt > now
                    ? "statusActive"
                    : startsAt > now
                      ? "statusScheduled"
                      : "statusEnded";
                  const statusColors = {
                    statusActive: { color: "#146c43", background: "#d1e7dd" },
                    statusScheduled: { color: "#084298", background: "#cfe2ff" },
                    statusEnded: { color: "#41464b", background: "#e2e3e5" },
                  };
                  const orderedProducts = getCampaignProductEntries(campaign, productById);
                  return (
                    <article key={campaign.id} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "13px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div>
                          <strong style={{ color: "#172b4d" }}>
                            {toDateTimeLabel(campaign.startsAt)} – {toDateTimeLabel(campaign.endsAt)}
                          </strong>
                          <span style={{ ...statusColors[status], display: "inline-block", marginLeft: "8px", borderRadius: "12px", padding: "3px 8px", fontSize: "11px", fontWeight: 700 }}>
                            {t(`aiRecommendations.${status}`)}
                          </span>
                        </div>
                      </div>
                      <ol style={{ paddingLeft: "20px", margin: "12px 0", color: "#495057" }}>
                        {orderedProducts.map(({ id, product }) => (
                          <li key={id} style={{ marginBottom: "4px" }}>
                            {product?.name || `#${id}`}
                            {product?.featured ? ` — ${t("aiRecommendations.featuredBadge")}` : ""}
                            {product && Number.isFinite(normalizedPriority(product))
                              ? ` · ${t("aiRecommendations.priorityBadge", { priority: product.priority })}`
                              : ""}
                          </li>
                        ))}
                      </ol>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => editCampaign(campaign)} style={secondaryButtonStyle}>
                          {t("aiRecommendations.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCampaign(campaign)}
                          disabled={deletingId === campaign.id}
                          style={{ ...secondaryButtonStyle, color: "#b02a37", borderColor: "#f1aeb5" }}
                        >
                          {deletingId === campaign.id ? t("aiRecommendations.saving") : t("aiRecommendations.delete")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}