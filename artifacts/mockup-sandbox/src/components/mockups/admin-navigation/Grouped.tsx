import { useState } from "react";
import {
  BadgePercent,
  BookOpenText,
  ChevronDown,
  LayoutDashboard,
  Megaphone,
  Package,
  ReceiptText,
  Settings2,
  ShoppingBasket,
  Sparkles,
  Truck,
  UsersRound,
  Image,
  Rss,
  Tags,
  Menu,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./_group.css";

type AdminSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
};

const sectionItems: AdminSection[] = [
  { id: "dashboard", label: "Panou", icon: LayoutDashboard, group: "overview" },
  { id: "products", label: "Produse", icon: Package, group: "catalog" },
  { id: "categories", label: "Categorii", icon: Boxes, group: "catalog" },
  { id: "suppliers", label: "Furnizori", icon: ShoppingBasket, group: "catalog" },
  { id: "orders", label: "Comenzi", icon: ShoppingBasket, group: "operations" },
  { id: "invoices", label: "Facturi", icon: ReceiptText, group: "operations" },
  { id: "wms", label: "WMS", icon: Truck, group: "operations" },
  { id: "marketing", label: "Marketing", icon: Megaphone, group: "growth" },
  { id: "ai-recommendations", label: "Recomandări AI", icon: Sparkles, group: "growth" },
  { id: "vouchers", label: "Vouchere", icon: BadgePercent, group: "growth" },
  { id: "blog", label: "Blog AI", icon: BookOpenText, group: "growth" },
  { id: "homepage-hero", label: "Cover Home", icon: Image, group: "growth" },
  { id: "google-feed", label: "Google Feed", icon: Rss, group: "growth" },
  { id: "users", label: "Clienți", icon: UsersRound, group: "admin" },
  { id: "company-settings", label: "Setări firmă", icon: Settings2, group: "admin" },
];

const navGroups = [
  { id: "catalog", title: "Catalog", icon: Package },
  { id: "operations", title: "Vânzări și operațiuni", icon: Truck },
  { id: "growth", title: "Marketing și promovare", icon: Megaphone },
  { id: "admin", title: "Administrare", icon: Settings2 },
];

function PreviewHeader() {
  return (
    <>
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
    </>
  );
}

export function Grouped({ initialMobileOpen = false }: { initialMobileOpen?: boolean }) {
  const [activeId, setActiveId] = useState("ai-recommendations");
  const [openGroup, setOpenGroup] = useState("growth");
  const [mobileOpen, setMobileOpen] = useState(initialMobileOpen);
  const activeItem = sectionItems.find((item) => item.id === activeId) ?? sectionItems[0];
  const activeGroup = navGroups.find((group) => group.id === activeItem.group);

  const selectItem = (item: AdminSection) => {
    setActiveId(item.id);
    setOpenGroup(item.group === "overview" ? "" : item.group);
    setMobileOpen(false);
  };

  return (
    <div className="admin-nav-prototype">
      <PreviewHeader />

      <div
        className={`grouped-admin-layout${mobileOpen ? " menu-open" : ""}`}
      >
        <aside className="grouped-admin-sidebar" aria-label="Navigarea Admin">
          <div className="grouped-sidebar-kicker">Spațiul tău de lucru</div>

          {sectionItems.filter((item) => item.group === "overview").map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`grouped-nav-link${activeId === item.id ? " is-active" : ""}`}
                aria-current={activeId === item.id ? "page" : undefined}
                onClick={() => selectItem(item)}
              >
                <span className="grouped-nav-link-icon"><Icon size={16} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="grouped-nav-divider" />

          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroup === group.id;
            const items = sectionItems.filter((item) => item.group === group.id);
            return (
              <div className="grouped-nav-group" key={group.id}>
                <button
                  className="grouped-nav-group-button"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? "" : group.id)}
                >
                  <span className="grouped-nav-link-icon"><GroupIcon size={16} /></span>
                  <span>{group.title}</span>
                  <ChevronDown
                    className={`grouped-nav-chevron${isOpen ? " is-open" : ""}`}
                    size={14}
                  />
                </button>
                {isOpen && (
                  <div className="grouped-nav-children">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`grouped-nav-link${activeId === item.id ? " is-active" : ""}`}
                          aria-current={activeId === item.id ? "page" : undefined}
                          onClick={() => selectItem(item)}
                        >
                          <span className="grouped-nav-link-icon"><Icon size={15} /></span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="grouped-admin-main">
          <button
            className="mobile-nav-toggle"
            type="button"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Menu size={16} />
            {mobileOpen ? "Închide meniul" : "Meniu Admin"}
          </button>
          <section className="grouped-admin-content">
            <div className="grouped-content-topline">
              <div className="admin-preview-breadcrumb">
                Admin{activeGroup ? ` / ${activeGroup.title}` : ""} / {activeItem.label}
              </div>
              <span className="grouped-section-label">Piața .ro</span>
            </div>
            <h1>{activeItem.id === "ai-recommendations" ? "Recomandări de produse AI" : activeItem.label}</h1>
            <p className="grouped-content-intro">
              {activeItem.id === "ai-recommendations"
                ? "Programează separat pentru fiecare piață două sau trei produse promovate."
                : `Previzualizare de navigare pentru secțiunea ${activeItem.label}.`}
            </p>

            <div className="grouped-feature-card">
              <div className="grouped-feature-copy">
                <span className="grouped-feature-eyebrow">Marketing și promovare</span>
                <strong>{activeItem.id === "ai-recommendations" ? "Campanii de recomandări programate" : activeItem.label}</strong>
                <p>
                  {activeItem.id === "ai-recommendations"
                    ? "Produsele, piața și intervalul campaniei rămân în aceeași pagină. Navigarea doar le organizează mai clar."
                    : "Conținutul și funcțiile existente rămân neschimbate; se modifică doar felul în care ajungi aici."}
                </p>
              </div>
              <button className="grouped-primary-action" type="button">
                {activeItem.id === "ai-recommendations" ? "+ Campanie nouă" : `Deschide ${activeItem.label}`}
              </button>
            </div>

            <div className="grouped-info-grid">
              <div className="grouped-info-tile">
                <span>STRUCTURĂ</span>
                <strong>5 zone de lucru</strong>
              </div>
              <div className="grouped-info-tile">
                <span>ACCES</span>
                <strong>15 destinații păstrate</strong>
              </div>
              <div className="grouped-info-tile">
                <span>CONTEXT</span>
                <strong>Grupul activ se deschide</strong>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}