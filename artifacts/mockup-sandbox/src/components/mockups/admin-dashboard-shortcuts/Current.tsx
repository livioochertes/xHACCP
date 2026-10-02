import { Package, ShoppingCart, Users } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <div className="admin-shortcuts-preview">
      <nav
        className="admin-dashboard-shortcuts"
        aria-label="Scurtături rapide"
        style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "12px 0 24px" }}
      >
        <button type="button" className="admin-report-text-button" onClick={() => undefined}>
          <ShoppingCart size={14} aria-hidden="true" /> Gestionare Comenzi
        </button>
        <button type="button" className="admin-report-text-button" onClick={() => undefined}>
          <Users size={14} aria-hidden="true" /> Gestionare Utilizatori
        </button>
        <button type="button" className="admin-report-text-button" onClick={() => undefined}>
          <Package size={14} aria-hidden="true" /> Gestionare Produse
        </button>
      </nav>
    </div>
  );
}