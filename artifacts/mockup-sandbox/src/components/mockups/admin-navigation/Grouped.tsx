import { useEffect, useRef, useState } from "react";
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
  { id: "marketing", label: "Marketing", icon: Megaphone, group: "growth" },
  { id: "ai-recommendations", label: "Recomandări AI", icon: Sparkles, group: "growth" },
  { id: "vouchers", label: "Vouchere", icon: BadgePercent, group: "growth" },
  { id: "blog", label: "Blog AI", icon: BookOpenText, group: "growth" },
  { id: "homepage-hero", label: "Cover Home", icon: Image, group: "growth" },
  { id: "google-feed", label: "Google Feed", icon: Rss, group: "growth" },
  { id: "users", label: "Clienți", icon: UsersRound, group: "admin" },
  { id: "company-settings", label: "Setări firmă", icon: Settings2, group: "admin" },
  { id: "wms", label: "WMS", icon: Truck, group: "admin" },
];

const navGroups = [
  { id: "catalog", title: "Catalog", icon: Package },
  { id: "operations", title: "Vânzări și operațiuni", icon: Truck },
  { id: "growth", title: "Marketing și promovare", icon: Megaphone },
  { id: "admin", title: "Administrare", icon: Settings2 },
];

const languageOptions = [
  { code: "RO", label: "Română", flag: "🇷🇴" },
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "FR", label: "Français", flag: "🇫🇷" },
];

function PreviewHeader() {
  const [languageCode, setLanguageCode] = useState("RO");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languagePickerRef = useRef<HTMLDivElement>(null);
  const languageTriggerRef = useRef<HTMLButtonElement>(null);
  const selectedLanguage = languageOptions.find((language) => language.code === languageCode) || languageOptions[0];

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !languagePickerRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
        languageTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [languageMenuOpen]);

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
          <div ref={languagePickerRef} style={{ position: "relative" }}>
            <button
              ref={languageTriggerRef}
              type="button"
              aria-label={`Limba panoului: ${selectedLanguage.label}`}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
              style={{
                display: "inline-flex",
                minHeight: "34px",
                alignItems: "center",
                gap: "7px",
                padding: "6px 9px",
                border: "1px solid #e1e5ed",
                borderRadius: "8px",
                background: "#fff",
                color: "#46536a",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 750,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "15px", lineHeight: 1 }}>{selectedLanguage.flag}</span>
              <span>{selectedLanguage.code}</span>
              <ChevronDown
                size={12}
                aria-hidden="true"
                style={{
                  color: "#8993a3",
                  transform: languageMenuOpen ? "rotate(180deg)" : "none",
                  transition: "transform 150ms ease",
                }}
              />
            </button>
            {languageMenuOpen && (
              <div
                role="menu"
                aria-label="Alege limba interfeței"
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "calc(100% + 6px)",
                  right: 0,
                  minWidth: "156px",
                  padding: "5px",
                  border: "1px solid #e5e9f0",
                  borderRadius: "10px",
                  background: "#fff",
                  boxShadow: "0 12px 30px rgba(32, 46, 69, 0.16)",
                }}
              >
                {languageOptions.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={languageCode === language.code}
                    onClick={() => {
                      setLanguageCode(language.code);
                      setLanguageMenuOpen(false);
                    }}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: "9px",
                      padding: "8px 9px",
                      border: 0,
                      borderRadius: "7px",
                      background: languageCode === language.code ? "#f0f2ff" : "transparent",
                      color: languageCode === language.code ? "#4f61cf" : "#4b586d",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: languageCode === language.code ? 700 : 550,
                      textAlign: "left",
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: "15px", lineHeight: 1 }}>{language.flag}</span>
                    <span style={{ flex: 1 }}>{language.label}</span>
                    <span style={{ color: "#8791a1", fontSize: "10px", fontWeight: 750 }}>{language.code}</span>
                  </button>
                ))}
              </div>
            )}
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
  const [activeId, setActiveId] = useState("wms");
  const [openGroup, setOpenGroup] = useState("admin");
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
            <h1>
              {activeItem.id === "ai-recommendations"
                ? "Recomandări de produse AI"
                : activeItem.id === "wms"
                  ? "Setări de integrare WMS"
                  : activeItem.label}
            </h1>
            <p className="grouped-content-intro">
              {activeItem.id === "ai-recommendations"
                ? "Programează separat pentru fiecare piață două sau trei produse promovate."
                : activeItem.id === "wms"
                  ? "Configurează integrările PAI cu sistemele WMS; operațiunile de vânzări și comenzi rămân grupate separat."
                  : `Previzualizare de navigare pentru secțiunea ${activeItem.label}.`}
            </p>

            <div className="grouped-feature-card">
              <div className="grouped-feature-copy">
                <span className="grouped-feature-eyebrow">{activeGroup?.title ?? "Spațiul tău de lucru"}</span>
                <strong>
                  {activeItem.id === "ai-recommendations"
                    ? "Campanii de recomandări programate"
                    : activeItem.id === "wms"
                      ? "Integrări PAI cu partenerii WMS"
                      : activeItem.label}
                </strong>
                <p>
                  {activeItem.id === "ai-recommendations"
                    ? "Produsele, piața și intervalul campaniei rămân în aceeași pagină. Navigarea doar le organizează mai clar."
                    : activeItem.id === "wms"
                      ? "Această zonă este dedicată setărilor de integrare PAI cu sistemele WMS, nu operațiunilor de depozit."
                      : "Conținutul și funcțiile existente rămân neschimbate; se modifică doar felul în care ajungi aici."}
                </p>
              </div>
              <button className="grouped-primary-action" type="button">
                {activeItem.id === "ai-recommendations"
                  ? "+ Campanie nouă"
                  : activeItem.id === "wms"
                    ? "Configurează integrări"
                    : `Deschide ${activeItem.label}`}
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