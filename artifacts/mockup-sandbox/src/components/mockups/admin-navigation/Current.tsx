import { useState } from "react";
import "./_group.css";

const currentItems = [
  { id: "dashboard", icon: "📊", label: "Panou" },
  { id: "orders", icon: "📋", label: "Comenzi" },
  { id: "products", icon: "📦", label: "Produse" },
  { id: "categories", icon: "📁", label: "Categorii" },
  { id: "suppliers", icon: "🏢", label: "Furnizori" },
  { id: "vouchers", icon: "🎟️", label: "Vouchere" },
  { id: "blog", icon: "📝", label: "Blog AI" },
  { id: "homepage-hero", icon: "🖼️", label: "Cover Home" },
  { id: "google-feed", icon: "🛍️", label: "Google Feed" },
  { id: "invoices", icon: "🧾", label: "Facturi" },
  { id: "users", icon: "👥", label: "Clienți" },
  { id: "company-settings", icon: "⚙️", label: "Setări firmă" },
  { id: "marketing", icon: "📣", label: "Marketing" },
  { id: "ai-recommendations", icon: "✨", label: "Recomandări AI" },
  { id: "wms", icon: "🚚", label: "WMS" },
];

export function Current() {
  const [activeView, setActiveView] = useState("ai-recommendations");
  const activeItem = currentItems.find((item) => item.id === activeView) ?? currentItems[0];

  return (
    <div className="admin-nav-prototype">
      <header className="admin-preview-header">
        <div className="admin-preview-brand">
          <img src="/__mockup/images/xhaccp-admin-logo.png" alt="" />
          <span>xHACCP Admin</span>
        </div>
        <div className="admin-preview-account">
          <span>Bun venit, Admin</span>
          <span className="admin-preview-superadmin">Superadmin</span>
          <div className="admin-preview-languages" aria-label="Limba panoului">
            <span>RO</span><span>EN</span><span>FR</span>
          </div>
          <button className="admin-preview-logout" type="button">Deconectare</button>
        </div>
      </header>

      <div className="admin-market-bar" aria-label="Selectarea pieței">
        <span className="admin-market-label">🌍 Marketplace:</span>
        <button className="admin-market-chip" type="button">🌐 All</button>
        <button className="admin-market-chip is-selected" type="button">🇷🇴 Romania (.ro)</button>
        <button className="admin-market-chip" type="button">🇫🇷 France (.fr)</button>
        <button className="admin-market-chip" type="button">🌐 International (.com)</button>
      </div>

      <nav className="current-nav-tabs" aria-label="Navigarea actuală din Admin">
        {currentItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`current-nav-tab${activeView === item.id ? " is-active" : ""}`}
            aria-current={activeView === item.id ? "page" : undefined}
            onClick={() => setActiveView(item.id)}
          >
            <span style={{ fontSize: "18px" }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="admin-preview-content">
        <div className="admin-preview-breadcrumb">Admin / {activeItem.label}</div>
        <h1>{activeItem.label === "Recomandări AI" ? "Recomandări de produse AI" : activeItem.label}</h1>
        <p className="admin-preview-description">
          {activeItem.id === "ai-recommendations"
            ? "Programează separat pentru fiecare piață două sau trei produse promovate."
            : `Previzualizare de navigare pentru secțiunea ${activeItem.label}.`}
        </p>
        <div className="admin-preview-card">
          <div className="admin-preview-card-copy">
            <strong>{activeItem.id === "ai-recommendations" ? "Programarea campaniilor" : activeItem.label}</strong>
            <span>
              {activeItem.id === "ai-recommendations"
                ? "Produsele, piața și intervalul campaniei rămân în aceeași pagină."
                : "Conținutul secțiunii se păstrează neschimbat."}
            </span>
          </div>
          <span className="admin-preview-card-tag">Piața .ro</span>
        </div>
      </main>
    </div>
  );
}