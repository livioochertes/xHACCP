import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Bell,
  BookOpenText,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Command,
  Download,
  Filter,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  RefreshCw,
  Rss,
  Search,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./Grouped.css";

type SectionId =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "suppliers"
  | "invoices"
  | "marketing"
  | "ai-recommendations"
  | "vouchers"
  | "blog"
  | "homepage-hero"
  | "google-feed"
  | "users"
  | "company-settings"
  | "wms";

type GroupId = "overview" | "operations" | "catalog" | "growth" | "admin";
type MarketId = "ALL" | "RO" | "FR" | "COM";

type AdminSection = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  group: GroupId;
  count?: string;
};

type OrderRow = {
  id: string;
  customer: string;
  market: Exclude<MarketId, "ALL">;
  itemCount: number;
  amount: string;
  status: string;
  tone: "pending" | "processing" | "good" | "archived";
  time: string;
};

type ResourceRow = {
  name: string;
  detail: string;
  status: string;
  tone: "pending" | "processing" | "good" | "archived";
  updated: string;
};

const sectionItems: AdminSection[] = [
  { id: "dashboard", label: "Panou", icon: LayoutDashboard, group: "overview" },
  { id: "orders", label: "Comenzi", icon: ShoppingCart, group: "operations", count: "12" },
  { id: "invoices", label: "Facturi", icon: ReceiptText, group: "operations" },
  { id: "products", label: "Produse", icon: Package, group: "catalog" },
  { id: "categories", label: "Categorii", icon: Boxes, group: "catalog" },
  { id: "suppliers", label: "Furnizori", icon: Store, group: "catalog" },
  { id: "marketing", label: "Marketing", icon: Megaphone, group: "growth" },
  { id: "ai-recommendations", label: "Recomandări AI", icon: Sparkles, group: "growth" },
  { id: "vouchers", label: "Vouchere", icon: BadgePercent, group: "growth" },
  { id: "blog", label: "Blog AI", icon: BookOpenText, group: "growth" },
  { id: "homepage-hero", label: "Cover Home", icon: ImageIcon, group: "growth" },
  { id: "google-feed", label: "Google Feed", icon: Rss, group: "growth" },
  { id: "users", label: "Clienți", icon: UsersRound, group: "admin" },
  { id: "company-settings", label: "Setări firmă", icon: Building2, group: "admin" },
  { id: "wms", label: "WMS", icon: Warehouse, group: "admin" },
];

const navGroups: { id: Exclude<GroupId, "overview">; label: string }[] = [
  { id: "operations", label: "Operațiuni" },
  { id: "catalog", label: "Catalog" },
  { id: "growth", label: "Marketing & creștere" },
  { id: "admin", label: "Administrare" },
];

const marketOptions: { id: MarketId; label: string; name: string }[] = [
  { id: "ALL", label: "ALL", name: "Toate piețele" },
  { id: "RO", label: "RO", name: "România" },
  { id: "FR", label: "FR", name: "Franța" },
  { id: "COM", label: ".COM", name: "Internațional" },
];

const pageMeta: Record<SectionId, { title: string; description: string; action: string }> = {
  dashboard: {
    title: "Bună dimineața, Admin.",
    description: "O privire limpede asupra comenzilor, piețelor și activității xHACCP.",
    action: "Comandă nouă",
  },
  orders: {
    title: "Comenzi",
    description: "Urmărește fiecare comandă, de la confirmarea plății până la expediere.",
    action: "Comandă nouă",
  },
  products: {
    title: "Produse",
    description: "Catalogul tău, cu stocurile și disponibilitatea fiecărei piețe la vedere.",
    action: "Produs nou",
  },
  categories: {
    title: "Categorii",
    description: "O structură clară face catalogul mai ușor de explorat și de întreținut.",
    action: "Categorie nouă",
  },
  suppliers: {
    title: "Furnizori",
    description: "Partenerii și condițiile comerciale, într-un singur loc.",
    action: "Furnizor nou",
  },
  invoices: {
    title: "Facturi",
    description: "Documentele fiscale și statusul fiecărei emiteri.",
    action: "Factură nouă",
  },
  marketing: {
    title: "Marketing",
    description: "Planifică mesajele și campaniile pentru fiecare piață.",
    action: "Campanie nouă",
  },
  "ai-recommendations": {
    title: "Recomandări AI",
    description: "Produse promovate atent, cu programare separată pentru fiecare piață.",
    action: "Programare nouă",
  },
  vouchers: {
    title: "Vouchere",
    description: "Coduri promoționale, reguli și rezultate fără pași în plus.",
    action: "Voucher nou",
  },
  blog: {
    title: "Blog AI",
    description: "Articolele editoriale și calendarul lor de publicare.",
    action: "Articol nou",
  },
  "homepage-hero": {
    title: "Cover Home",
    description: "Păstrează mesajul principal al fiecărei piețe la zi.",
    action: "Adaugă cover",
  },
  "google-feed": {
    title: "Google Feed",
    description: "Verifică sincronizarea catalogului și eligibilitatea produselor.",
    action: "Sincronizează",
  },
  users: {
    title: "Clienți",
    description: "Conturi, activitate și suport, cu contextul fiecărei piețe.",
    action: "Client nou",
  },
  "company-settings": {
    title: "Setări firmă",
    description: "Datele companiei și preferințele administrative xHACCP.",
    action: "Editează setările",
  },
  wms: {
    title: "WMS",
    description: "Conexiunile logistice și statusul sincronizării comenzilor.",
    action: "Adaugă integrare",
  },
};

const sampleOrders: OrderRow[] = [
  { id: "XC-10842", customer: "Ana Popescu", market: "RO", itemCount: 8, amount: "1.284,50 lei", status: "Nouă", tone: "pending", time: "10:42" },
  { id: "XC-10841", customer: "Maison Dubois", market: "FR", itemCount: 3, amount: "364,80 €", status: "În pregătire", tone: "processing", time: "10:18" },
  { id: "XC-10840", customer: "Bucătăria Nord", market: "RO", itemCount: 12, amount: "2.910,00 lei", status: "Expediată", tone: "good", time: "09:56" },
  { id: "XC-10839", customer: "Marco Bellini", market: "COM", itemCount: 5, amount: "518,25 €", status: "Nouă", tone: "pending", time: "09:31" },
  { id: "XC-10838", customer: "Atelier du Goût", market: "FR", itemCount: 2, amount: "172,00 €", status: "Finalizată", tone: "archived", time: "Ieri" },
  { id: "XC-10837", customer: "Elena Radu", market: "RO", itemCount: 6, amount: "740,20 lei", status: "În pregătire", tone: "processing", time: "Ieri" },
];

const sampleProducts = [
  { sku: "GN-1206", name: "Recipient GN 1/2 · inox", category: "Depozitare", stock: "148 buc.", market: "RO", state: "Activ", tone: "good" as const },
  { sku: "MX-0441", name: "Mixer vertical Pro 450", category: "Echipamente", stock: "21 buc.", market: "FR", state: "Stoc redus", tone: "pending" as const },
  { sku: "TH-0208", name: "Termometru digital T8", category: "Măsurare", stock: "86 buc.", market: "COM", state: "Activ", tone: "good" as const },
  { sku: "CU-0316", name: "Cuțit Chef 20 cm", category: "Ustensile", stock: "0 buc.", market: "RO", state: "Indisponibil", tone: "archived" as const },
  { sku: "ST-0904", name: "Tavă perforată 60 × 40", category: "Coacere", stock: "42 buc.", market: "FR", state: "Activ", tone: "good" as const },
];

const resourceRows: Partial<Record<SectionId, ResourceRow[]>> = {
  suppliers: [
    { name: "Nord Inox Distribution", detail: "Echipamente · România", status: "Activ", tone: "good", updated: "Astăzi, 09:14" },
    { name: "Maison Cuisine Pro", detail: "Ustensile · Franța", status: "Revizie", tone: "pending", updated: "Ieri, 16:32" },
    { name: "Alimentaria S.L.", detail: "Consumabile · Internațional", status: "Activ", tone: "good", updated: "12 mai 2025" },
  ],
  invoices: [
    { name: "Factura XC-2025-184", detail: "XC-10842 · Ana Popescu", status: "De emis", tone: "pending", updated: "Astăzi, 10:42" },
    { name: "Factura FR-2025-093", detail: "XC-10841 · Maison Dubois", status: "Trimisă", tone: "good", updated: "Astăzi, 10:18" },
    { name: "Factura XC-2025-182", detail: "XC-10840 · Bucătăria Nord", status: "Achitată", tone: "processing", updated: "Astăzi, 09:56" },
  ],
  marketing: [
    { name: "Primăvară în bucătărie", detail: "Email · RO + FR", status: "Programată", tone: "processing", updated: "20 mai · 09:00" },
    { name: "Echipamente pro", detail: "Banner · România", status: "Activă", tone: "good", updated: "Până la 31 mai" },
    { name: "Colecția atelier", detail: "Social · Franța", status: "Ciornă", tone: "archived", updated: "Editat acum 2 zile" },
  ],
  "ai-recommendations": [
    { name: "Top produse · săptămâna 21", detail: "3 produse · România", status: "Programată", tone: "processing", updated: "19 mai · 08:00" },
    { name: "Pentru atelierul tău", detail: "3 produse · Franța", status: "Activă", tone: "good", updated: "Până la 24 mai" },
    { name: "Noutăți pentru profesioniști", detail: "2 produse · Internațional", status: "Ciornă", tone: "archived", updated: "Editat ieri" },
  ],
  vouchers: [
    { name: "ATELIER12", detail: "12% reducere · România", status: "Activ", tone: "good", updated: "Expiră în 8 zile" },
    { name: "BONJOUR8", detail: "8% reducere · Franța", status: "Programat", tone: "processing", updated: "Începe pe 21 mai" },
    { name: "PROFI25", detail: "25 lei reducere · România", status: "Pauzat", tone: "archived", updated: "Editat pe 14 mai" },
  ],
  blog: [
    { name: "Cum alegi recipientele GN", detail: "Ghid · România", status: "Publicat", tone: "good", updated: "17 mai 2025" },
    { name: "L'inox en cuisine pro", detail: "Articol · Franța", status: "În revizie", tone: "pending", updated: "Editat ieri" },
    { name: "Organizarea unui atelier", detail: "Ghid · Internațional", status: "Ciornă", tone: "archived", updated: "Editat pe 13 mai" },
  ],
  "homepage-hero": [
    { name: "Atelierul începe aici", detail: "Cover principal · România", status: "Activ", tone: "good", updated: "Din 08 mai" },
    { name: "Le goût du métier", detail: "Cover principal · Franța", status: "Programat", tone: "processing", updated: "Din 21 mai" },
    { name: "Pentru profesioniști", detail: "Cover secundar · .com", status: "Ciornă", tone: "archived", updated: "Editat pe 12 mai" },
  ],
  "google-feed": [
    { name: "Catalog RO", detail: "1.248 produse eligibile", status: "Sincronizat", tone: "good", updated: "Acum 12 min" },
    { name: "Catalog FR", detail: "942 produse eligibile", status: "Sincronizat", tone: "good", updated: "Acum 19 min" },
    { name: "Catalog .com", detail: "18 produse de verificat", status: "Atenție", tone: "pending", updated: "Acum 28 min" },
  ],
  users: [
    { name: "Ana Popescu", detail: "Client · România", status: "Activ", tone: "good", updated: "Comandă acum 18 min" },
    { name: "Maison Dubois", detail: "Client · Franța", status: "Activ", tone: "good", updated: "Comandă acum 42 min" },
    { name: "Bucătăria Nord", detail: "Client business · România", status: "Verificare", tone: "pending", updated: "Actualizat ieri" },
  ],
  "company-settings": [
    { name: "Date companie", detail: "Identificare și adresă fiscală", status: "Complet", tone: "good", updated: "Actualizat pe 06 mai" },
    { name: "Facturare", detail: "Furnizori și numerotare", status: "Complet", tone: "good", updated: "Actualizat pe 14 mai" },
    { name: "Notificări", detail: "Emailuri și evenimente", status: "De verificat", tone: "pending", updated: "2 preferințe noi" },
  ],
};

const chartValues = [35, 49, 43, 62, 55, 71, 47, 58, 77, 64, 82, 69, 93, 74, 88, 68, 96, 79, 85, 100, 72, 91, 77, 87];
const chartLabels = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "Azi"];

function StatusPill({ label, tone }: { label: string; tone: ResourceRow["tone"] | OrderRow["tone"] }) {
  const toneClass = tone === "good" ? "" : ` is-${tone}`;
  return <span className={`admin-status${toneClass}`}>{label}</span>;
}

function OrderTable({
  rows,
  onOpenOrder,
}: {
  rows: OrderRow[];
  onOpenOrder: (order: OrderRow) => void;
}) {
  if (!rows.length) {
    return <div className="admin-table-empty">Nicio comandă nu corespunde filtrelor.</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-data-table">
        <thead>
          <tr>
            <th>Comandă</th>
            <th>Client</th>
            <th>Piață</th>
            <th>Articole</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td>
                <span className="admin-table-primary">{order.id}</span>
                <span className="admin-table-secondary"> · {order.time}</span>
              </td>
              <td>{order.customer}</td>
              <td><span className="admin-market-code">{order.market}</span></td>
              <td>{order.itemCount}</td>
              <td className="admin-table-primary">{order.amount}</td>
              <td><StatusPill label={order.status} tone={order.tone} /></td>
              <td>
                <button
                  className="admin-table-action"
                  type="button"
                  aria-label={`Detalii comandă ${order.id}`}
                  onClick={() => onOpenOrder(order)}
                >
                  <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  change: string;
  icon: LucideIcon;
  highlight?: boolean;
}) {
  return (
    <article className={`admin-stat-card${highlight ? " is-highlight" : ""}`}>
      <div className="admin-stat-heading">
        <span>{label}</span>
        <Icon size={15} aria-hidden="true" />
      </div>
      <strong className="admin-stat-value">{value}</strong>
      <div className="admin-stat-foot">
        <strong><ArrowUpRight size={11} /> {change}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function DashboardWorkspace({
  onNavigate,
  onOpenOrder,
  orders,
  onNotify,
}: {
  onNavigate: (id: SectionId) => void;
  onOpenOrder: (order: OrderRow) => void;
  orders: OrderRow[];
  onNotify: (message: string) => void;
}) {
  return (
    <>
      <div className="admin-dashboard-grid">
        <StatCard label="Vânzări nete" value="48.392 lei" detail="față de săptămâna trecută" change="+8,4%" icon={Activity} highlight />
        <StatCard label="Comenzi active" value="126" detail="în toate piețele" change="+12,1%" icon={ShoppingCart} />
        <StatCard label="Valoare medie" value="386 lei" detail="în ultimele 7 zile" change="+3,7%" icon={ArrowDownRight} />
        <StatCard label="Produse active" value="2.184" detail="catalog sincronizat" change="+24" icon={Package} />
      </div>

      <div className="admin-dashboard-lower">
        <section className="admin-panel">
          <header className="admin-panel-heading">
            <div>
              <h2>Ritmul comenzilor</h2>
              <p>Activitate în ultimele 24 de ore</p>
            </div>
            <button type="button" onClick={() => onNotify("Intervalul graficului este actualizat la ultimele 24 de ore.")}>
              <CalendarDays size={12} /> 24 ore <ChevronDown size={11} />
            </button>
          </header>
          <div className="admin-chart-wrap">
            <div className="admin-chart-summary">
              <strong>€ 12.840</strong>
              <span>venit net · toate piețele</span>
            </div>
            <div className="admin-chart" aria-label="Graficul comenzilor din ultimele 24 de ore">
              {chartValues.map((value, index) => (
                <div
                  className={`admin-chart-bar${index === chartValues.length - 1 ? " is-current" : ""}`}
                  key={`${chartLabels[index]}-${index}`}
                  title={`${value} comenzi`}
                >
                  <span style={{ height: `${value}%` }} />
                  {index % 4 === 0 || index === chartValues.length - 1 ? <label>{chartLabels[index]}</label> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <header className="admin-panel-heading">
            <div>
              <h2>Ultimele comenzi</h2>
              <p>Activitate recentă în platformă</p>
            </div>
            <button type="button" onClick={() => onNavigate("orders")}>
              Toate <ArrowRight size={12} />
            </button>
          </header>
          <div className="admin-mini-feed">
            {orders.slice(0, 4).map((order, index) => (
              <button
                className="admin-feed-item admin-feed-button"
                key={order.id}
                type="button"
                onClick={() => onOpenOrder(order)}
              >
                <span className={`admin-feed-symbol${index === 1 ? " is-coral" : ""}`}><ShoppingCart size={14} /></span>
                <span className="admin-feed-copy">
                  <strong>{order.customer}</strong>
                  <span>{order.id} · {order.market} · {order.time}</span>
                </span>
                <span className="admin-feed-price">{order.amount.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-panel admin-orders-preview">
        <header className="admin-panel-heading">
          <div>
            <h2>Comenzi de verificat</h2>
            <p>Acțiune necesară în următoarele ore</p>
          </div>
          <button type="button" onClick={() => onNotify("Lista de comenzi este actualizată.")}>
            <RefreshCw size={12} /> Actualizează
          </button>
        </header>
        <OrderTable rows={orders.slice(0, 3)} onOpenOrder={onOpenOrder} />
      </section>
    </>
  );
}

function ProductsWorkspace({
  market,
  search,
  onNotify,
}: {
  market: MarketId;
  search: string;
  onNotify: (message: string) => void;
}) {
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "unavailable">("all");
  const products = useMemo(() => sampleProducts.filter((product) => {
    const marketMatch = market === "ALL" || product.market === market || product.market === "COM";
    const queryMatch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    const stockMatch = stockFilter === "all"
      || (stockFilter === "low" && product.tone === "pending")
      || (stockFilter === "unavailable" && product.tone === "archived");
    return marketMatch && queryMatch && stockMatch;
  }), [market, search, stockFilter]);

  return (
    <>
      <div className="admin-content-toolbar">
        <div className="admin-filter-tabs" aria-label="Filtru stoc">
          <button className={stockFilter === "all" ? "is-active" : ""} type="button" aria-pressed={stockFilter === "all"} onClick={() => setStockFilter("all")}>Toate <span>2.184</span></button>
          <button className={stockFilter === "low" ? "is-active" : ""} type="button" aria-pressed={stockFilter === "low"} onClick={() => setStockFilter("low")}>Stoc redus <span>18</span></button>
          <button className={stockFilter === "unavailable" ? "is-active" : ""} type="button" aria-pressed={stockFilter === "unavailable"} onClick={() => setStockFilter("unavailable")}>Indisponibile <span>7</span></button>
        </div>
        <div className="admin-toolbar-tools">
          <button className="admin-button" type="button" onClick={() => onNotify("Filtrele avansate sunt pregătite.")}><SlidersHorizontal size={13} /> Filtre</button>
          <button className="admin-button" type="button" onClick={() => onNotify("Exportul catalogului este pregătit.")}><Download size={13} /> Exportă</button>
        </div>
      </div>
      <section className="admin-panel admin-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr><th>Produs</th><th>Categorie</th><th>Stoc</th><th>Piață</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.sku}>
                  <td>
                    <span className="admin-product-mark">{product.sku.slice(0, 2)}</span>
                    <span className="admin-table-primary">{product.name}</span>
                    <span className="admin-table-secondary"> · {product.sku}</span>
                  </td>
                  <td>{product.category}</td>
                  <td>{product.stock}</td>
                  <td><span className="admin-market-code">{product.market}</span></td>
                  <td><StatusPill label={product.state} tone={product.tone} /></td>
                  <td><button className="admin-table-action" type="button" aria-label={`Opțiuni ${product.name}`} onClick={() => onNotify(`Opțiuni pentru ${product.name}.`)}><MoreHorizontal size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.length && <div className="admin-table-empty">Nu există produse pentru căutarea curentă.</div>}
        </div>
        <DataFoot count={`Se afișează ${products.length} produse din 2.184`} onNotify={onNotify} />
      </section>
    </>
  );
}

function CategoriesWorkspace({ onCreate, onNotify }: { onCreate: () => void; onNotify: (message: string) => void }) {
  const [categoryFilter, setCategoryFilter] = useState<"all" | "visible">("all");
  const categories = [
    { title: "Echipamente", count: "486 produse", icon: Package, description: "Utilaje și aparatură profesională", visible: true },
    { title: "Ustensile", count: "372 produse", icon: Tag, description: "Instrumente pentru lucru zilnic", visible: true },
    { title: "Depozitare", count: "284 produse", icon: Boxes, description: "Recipiente, rafturi și organizare", visible: true },
    { title: "Coacere", count: "318 produse", icon: Activity, description: "Tăvi, forme și accesorii", visible: true },
    { title: "Măsurare", count: "129 produse", icon: Filter, description: "Control și precizie în bucătărie", visible: false },
    { title: "Igienă", count: "215 produse", icon: Check, description: "Siguranță și curățenie alimentară", visible: true },
  ];
  const filteredCategories = categoryFilter === "visible" ? categories.filter((category) => category.visible) : categories;

  return (
    <>
      <div className="admin-content-toolbar">
        <div className="admin-filter-tabs">
          <button className={categoryFilter === "all" ? "is-active" : ""} type="button" aria-pressed={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>Toate categoriile</button>
          <button className={categoryFilter === "visible" ? "is-active" : ""} type="button" aria-pressed={categoryFilter === "visible"} onClick={() => setCategoryFilter("visible")}>Vizibile pe site</button>
        </div>
        <button className="admin-button" type="button" onClick={onCreate}><Plus size={13} /> Categorie nouă</button>
      </div>
      <div className="admin-category-grid">
        {filteredCategories.map(({ title, count, icon: Icon, description }) => (
          <button className="admin-category-card" key={title} type="button" onClick={() => onNotify(`Categoria „${title}” este selectată.`)}>
            <span className="admin-category-icon"><Icon size={15} /></span>
            <strong>{title}</strong>
            <span>{count} · {description}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function WmsWorkspace({ onNotify }: { onNotify: (message: string) => void }) {
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const integrations = [
    { id: "wms-ro", monogram: "RO", name: "LogiHub România", detail: "API v2 · sincronizare automată la 15 min", status: "Conectat" },
    { id: "wms-fr", monogram: "FR", name: "ColisPro France", detail: "API v1 · ultima sincronizare acum 8 min", status: "Conectat" },
    { id: "wms-com", monogram: ".C", name: "Fulfilment Global", detail: "Webhook · sunt necesare credențiale noi", status: "Verificare" },
  ];

  return (
    <div className="admin-integration-list">
      {integrations.map((item) => (
        <article className="admin-integration-row" key={item.id}>
          <span className="admin-integration-mark">{item.monogram}</span>
          <div className="admin-integration-copy">
            <strong>{item.name}</strong>
            <span>{item.detail}</span>
          </div>
          <StatusPill label={tested[item.id] ? "Test reușit" : item.status} tone={tested[item.id] || item.status === "Conectat" ? "good" : "pending"} />
          <button
            className="admin-inline-link"
            type="button"
            onClick={() => {
              setTested((previous) => ({ ...previous, [item.id]: true }));
              onNotify(`Conexiunea ${item.name} a fost testată în previzualizare.`);
            }}
          >
            Testează conexiunea
          </button>
        </article>
      ))}
    </div>
  );
}

function GenericWorkspace({
  activeId,
  onNotify,
}: {
  activeId: SectionId;
  onNotify: (message: string) => void;
}) {
  const rows = resourceRows[activeId] ?? [];
  const ResourceIcon = activeId === "vouchers" ? BadgePercent : activeId === "blog" ? BookOpenText : activeId === "users" ? UsersRound : activeId === "company-settings" ? Building2 : activeId === "marketing" ? Megaphone : activeId === "homepage-hero" ? ImageIcon : activeId === "google-feed" ? Globe2 : activeId === "invoices" ? ReceiptText : Sparkles;

  return (
    <>
      <div className="admin-resource-grid">
        {rows.map((row, index) => (
          <article className="admin-resource-card" key={row.name}>
            <span className={`admin-resource-icon${index === 1 ? " is-alt" : ""}`}><ResourceIcon size={15} /></span>
            <strong>{row.name}</strong>
            <span>{row.detail}</span>
            <StatusPill label={row.status} tone={row.tone} />
          </article>
        ))}
      </div>
      <section className="admin-panel admin-table-panel admin-resource-table">
        <header className="admin-panel-heading">
          <div>
            <h2>Activitate recentă</h2>
            <p>Actualizările din această secțiune</p>
          </div>
          <button type="button" onClick={() => onNotify("Activitatea este actualizată.")}><RefreshCw size={12} /> Actualizează</button>
        </header>
        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead><tr><th>Nume</th><th>Detalii</th><th>Status</th><th>Actualizat</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td className="admin-table-primary">{row.name}</td>
                  <td>{row.detail}</td>
                  <td><StatusPill label={row.status} tone={row.tone} /></td>
                  <td>{row.updated}</td>
                  <td><button className="admin-table-action" type="button" aria-label={`Deschide ${row.name}`} onClick={() => onNotify(`${row.name} este selectat.`)}><ChevronRight size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DataFoot({ count, onNotify }: { count: string; onNotify: (message: string) => void }) {
  return (
    <footer className="admin-data-foot">
      <span>{count}</span>
      <div className="admin-pagination" aria-label="Paginare">
        <button type="button" aria-label="Pagina anterioară" onClick={() => onNotify("Ești pe prima pagină.")}><ChevronLeft size={12} /></button>
        <button className="is-current" type="button" aria-current="page" onClick={() => onNotify("Pagina 1 este selectată.")}>1</button>
        <button type="button" onClick={() => onNotify("Pagina 2 este pregătită în previzualizare.")}>2</button>
        <button type="button" onClick={() => onNotify("Pagina 3 este pregătită în previzualizare.")}>3</button>
        <button type="button" aria-label="Pagina următoare" onClick={() => onNotify("Pagina următoare este pregătită în previzualizare.")}><ChevronRight size={12} /></button>
      </div>
    </footer>
  );
}

export function Grouped() {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<SectionId>("dashboard");
  const [openGroups, setOpenGroups] = useState<Record<Exclude<GroupId, "overview">, boolean>>({
    operations: true,
    catalog: true,
    growth: false,
    admin: true,
  });
  const [market, setMarket] = useState<MarketId>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState("Toate");
  const [toast, setToast] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [modal, setModal] = useState<"create" | "order" | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  const activeItem = sectionItems.find((item) => item.id === activeId) ?? sectionItems[0];
  const activeGroup = activeItem.group === "overview"
    ? "Privire de ansamblu"
    : navGroups.find((group) => group.id === activeItem.group)?.label ?? "Administrare";

  const filteredOrders = useMemo(() => sampleOrders.filter((order) => {
    const matchesMarket = market === "ALL" || order.market === market;
    const matchesSearch = `${order.id} ${order.customer} ${order.market}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = orderFilter === "Toate"
      || (orderFilter === "Neprocesate" && order.tone === "pending")
      || (orderFilter === "În lucru" && order.tone === "processing")
      || (orderFilter === "Finalizate" && (order.tone === "good" || order.tone === "archived"));
    return matchesMarket && matchesSearch && matchesStatus;
  }), [market, orderFilter, searchTerm]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setSelectedOrder(null);
        setNotificationsOpen(false);
        setAccountOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const notify = (message: string) => setToast(message);

  const navigateTo = (id: SectionId) => {
    setActiveId(id);
    setMobileOpen(false);
    setSearchTerm("");
    setOrderFilter("Toate");
  };

  const toggleGroup = (id: Exclude<GroupId, "overview">) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroups((previous) => ({ ...previous, [id]: true }));
      return;
    }
    setOpenGroups((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const openOrder = (order: OrderRow) => {
    setSelectedOrder(order);
    setModal("order");
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim();
    if (!name) return;
    setModal(null);
    notify(`„${name}” a fost adăugat în previzualizare.`);
  };

  const createLabel = pageMeta[activeId].action;
  const handlePrimaryAction = () => {
    if (activeId === "google-feed") {
      notify("Sincronizarea catalogului Google a fost pornită în previzualizare.");
      return;
    }
    setModal("create");
  };

  return (
    <div className={`admin-nav-prototype admin-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      <header className="admin-topbar">
        <button className="admin-mobile-menu" type="button" aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <div className="admin-brand" aria-label="xHACCP Admin">
          <span className="admin-brand-mark" aria-hidden="true">x</span>
          <span className="admin-brand-wordmark">xHACCP <small>CONTROL CENTER</small></span>
        </div>

        <label className="admin-topbar-search">
          <Search size={14} aria-hidden="true" />
          <input
            aria-label="Caută în pagina curentă"
            placeholder="Caută comenzi, produse, clienți…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <span className="admin-search-shortcut"><Command size={9} /> K</span>
        </label>

        <div className="admin-topbar-actions">
          <div className="admin-market-switch" role="group" aria-label="Selectează piața">
            {marketOptions.map((option) => (
              <button
                key={option.id}
                className={market === option.id ? "is-active" : ""}
                type="button"
                aria-pressed={market === option.id}
                title={option.name}
                onClick={() => {
                  setMarket(option.id);
                  notify(`Contextul a fost schimbat: ${option.name}.`);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="admin-popover-anchor">
            <button className="admin-icon-button" type="button" aria-label="Notificări" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setAccountOpen(false); }}>
              <Bell size={15} /><span className="admin-notification-dot" />
            </button>
            {notificationsOpen && (
              <div className="admin-popover" role="dialog" aria-label="Notificări recente">
                <div className="admin-popover-title">Noutăți pentru tine</div>
                <button className="admin-popover-item" type="button" onClick={() => { setNotificationsOpen(false); navigateTo("orders"); }}>
                  <ShoppingCart size={13} />
                  <span>12 comenzi noi<small>Verifică comenzile de astăzi</small></span>
                </button>
                <button className="admin-popover-item" type="button" onClick={() => { setNotificationsOpen(false); navigateTo("google-feed"); }}>
                  <Rss size={13} />
                  <span>Feed .com actualizat<small>18 produse cer atenție</small></span>
                </button>
              </div>
            )}
          </div>

          <button className="admin-icon-button admin-help-button" type="button" aria-label="Ajutor" onClick={() => notify("Centrul de ajutor xHACCP este pregătit.")}>
            <CircleHelp size={15} />
          </button>

          <div className="admin-popover-anchor">
            <button className="admin-account-button" type="button" aria-expanded={accountOpen} onClick={() => { setAccountOpen((open) => !open); setNotificationsOpen(false); }}>
              <span className="admin-account-avatar">AD</span>
              <span className="admin-account-copy"><strong>Admin</strong><span>SUPERADMIN</span></span>
              <ChevronDown size={12} />
            </button>
            {accountOpen && (
              <div className="admin-popover admin-account-popover" role="menu" aria-label="Meniul contului">
                <div className="admin-popover-title">Cont de administrator</div>
                <button className="admin-popover-item" type="button" role="menuitem" onClick={() => { setAccountOpen(false); navigateTo("company-settings"); }}>
                  <Settings2 size={13} /><span>Preferințe<small>Setări administrative</small></span>
                </button>
                <button className="admin-popover-item" type="button" role="menuitem" onClick={() => { setAccountOpen(false); notify("Sesiunea demo este activă.") }}>
                  <X size={13} /><span>Deconectare<small>Acțiune demonstrativă</small></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="admin-workspace">
        <aside className="admin-sidebar" aria-label="Navigare Admin">
          <div className="admin-sidebar-top">
            <span className="admin-sidebar-caption">NAVIGARE</span>
            <button
              className="admin-sidebar-toggle"
              type="button"
              aria-label={collapsed ? "Extinde navigarea" : "Retrage navigarea"}
              aria-pressed={collapsed}
              title={collapsed ? "Extinde navigarea" : "Retrage navigarea"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>

          <div className="admin-sidebar-workspace" title={marketOptions.find((option) => option.id === market)?.name}>
            <span className="admin-market-monogram">{market === "ALL" ? <Globe2 size={14} /> : market}</span>
            <span className="admin-sidebar-workspace-copy">
              <strong>{marketOptions.find((option) => option.id === market)?.name}</strong>
              <span>{market === "ALL" ? "Acces global" : `Context · ${market}`}</span>
            </span>
          </div>

          <nav className="admin-sidebar-nav" aria-label="Secțiuni Admin">
            <div className="admin-nav-group admin-overview-group">
              {sectionItems.filter((item) => item.group === "overview").map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`admin-nav-item${activeId === item.id ? " is-active" : ""}`}
                    type="button"
                    aria-current={activeId === item.id ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => navigateTo(item.id)}
                  >
                    <span className="admin-nav-item-icon"><Icon size={16} /></span>
                    <span className="admin-nav-item-label">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {navGroups.map((group) => {
              const expanded = collapsed || openGroups[group.id];
              const groupItems = sectionItems.filter((item) => item.group === group.id);
              return (
                <div className="admin-nav-group" key={group.id}>
                  <button
                    className="admin-nav-group-heading"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={expanded ? "is-open" : ""} size={12} />
                  </button>
                  {expanded && groupItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        className={`admin-nav-item${activeId === item.id ? " is-active" : ""}`}
                        type="button"
                        aria-current={activeId === item.id ? "page" : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={() => navigateTo(item.id)}
                      >
                        <span className="admin-nav-item-icon"><Icon size={15} /></span>
                        <span className="admin-nav-item-label">{item.label}</span>
                        {item.count && <span className="admin-nav-count">{item.count}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="admin-sidebar-bottom">
            <button className="admin-nav-item" type="button" title={collapsed ? "Setări" : undefined} onClick={() => navigateTo("company-settings")}>
              <span className="admin-nav-item-icon"><Settings2 size={15} /></span>
              <span className="admin-nav-item-label">Setări</span>
            </button>
          </div>
        </aside>

        {mobileOpen && <button className="admin-sidebar-scrim" type="button" aria-label="Închide meniul" onClick={() => setMobileOpen(false)} />}

        <main className="admin-main">
          <div className="admin-page">
            <div className="admin-page-context">
              <span>ADMIN</span><ChevronRight size={10} /><strong>{activeGroup}</strong><ChevronRight size={10} /><strong>{activeItem.label}</strong>
            </div>
            <header className="admin-page-heading">
              <div className="admin-page-heading-copy">
                <h1>{pageMeta[activeId].title}</h1>
                <p>{pageMeta[activeId].description}</p>
              </div>
              <div className="admin-page-actions">
                <button className="admin-button" type="button" onClick={() => notify(`Exportul pentru „${activeItem.label}” este pregătit în previzualizare.`)}>
                  <Download size={13} /> Exportă
                </button>
                <button className="admin-button admin-button-primary" type="button" onClick={handlePrimaryAction}>
                  <Plus size={14} /> {createLabel}
                </button>
              </div>
            </header>

            {activeId === "dashboard" && (
              <DashboardWorkspace
                onNavigate={navigateTo}
                onOpenOrder={openOrder}
                orders={filteredOrders.slice(0, 4)}
                onNotify={notify}
              />
            )}

            {activeId === "orders" && (
              <>
                <div className="admin-content-toolbar">
                  <div className="admin-filter-tabs" aria-label="Filtrează comenzile">
                    {["Toate", "Neprocesate", "În lucru", "Finalizate"].map((filter) => (
                      <button
                        className={orderFilter === filter ? "is-active" : ""}
                        type="button"
                        key={filter}
                        aria-pressed={orderFilter === filter}
                        onClick={() => setOrderFilter(filter)}
                      >
                        {filter}{filter === "Neprocesate" ? <span> 12</span> : ""}
                      </button>
                    ))}
                  </div>
                  <div className="admin-toolbar-tools">
                    <label className="admin-inline-search">
                      <Search size={12} />
                      <input aria-label="Caută comenzi" placeholder="Caută..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                    </label>
                    <button className="admin-button" type="button" onClick={() => notify("Filtrele avansate sunt deschise în previzualizare.")}><Filter size={13} /> Filtre</button>
                  </div>
                </div>
                <section className="admin-panel admin-table-panel">
                  <OrderTable rows={filteredOrders} onOpenOrder={openOrder} />
                  <DataFoot count={`Se afișează ${filteredOrders.length} comenzi din 126`} onNotify={notify} />
                </section>
              </>
            )}

            {activeId === "products" && <ProductsWorkspace market={market} search={searchTerm} onNotify={notify} />}
            {activeId === "categories" && <CategoriesWorkspace onCreate={() => setModal("create")} onNotify={notify} />}
            {activeId === "wms" && <WmsWorkspace onNotify={notify} />}
            {activeId !== "dashboard" && activeId !== "orders" && activeId !== "products" && activeId !== "categories" && activeId !== "wms" && (
              <GenericWorkspace activeId={activeId} onNotify={notify} />
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div className="admin-toast" role="status">
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}

      {modal === "create" && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title">
            <header className="admin-modal-heading">
              <div>
                <h2 id="admin-create-title">{createLabel}</h2>
                <p>Completează un detaliu pentru previzualizarea locală.</p>
              </div>
              <button className="admin-modal-close" type="button" aria-label="Închide" onClick={() => setModal(null)}><X size={15} /></button>
            </header>
            <form className="admin-modal-form" onSubmit={handleCreate}>
              <label>
                Nume
                <input name="name" autoFocus required placeholder={`Nume pentru ${activeItem.label.toLowerCase()}`} />
              </label>
              <label>
                Piață
                <select name="market" defaultValue={market}>
                  {marketOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
              <div className="admin-modal-note">Acesta este un prototip vizual; modificarea nu se salvează în date reale.</div>
              <div className="admin-modal-actions">
                <button className="admin-button" type="button" onClick={() => setModal(null)}>Anulează</button>
                <button className="admin-button admin-button-primary" type="submit"><Check size={13} /> Salvează în previzualizare</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modal === "order" && selectedOrder && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModal(null); setSelectedOrder(null); } }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-order-title">
            <header className="admin-modal-heading">
              <div>
                <h2 id="admin-order-title">{selectedOrder.id}</h2>
                <p>{selectedOrder.customer} · {selectedOrder.market} · {selectedOrder.time}</p>
              </div>
              <button className="admin-modal-close" type="button" aria-label="Închide detaliile comenzii" onClick={() => { setModal(null); setSelectedOrder(null); }}><X size={15} /></button>
            </header>
            <div className="admin-order-detail-grid">
              <div><span>Status</span><StatusPill label={selectedOrder.status} tone={selectedOrder.tone} /></div>
              <div><span>Articole</span><strong>{selectedOrder.itemCount} produse</strong></div>
              <div><span>Total</span><strong>{selectedOrder.amount}</strong></div>
              <div><span>Livrare estimată</span><strong>21 mai 2025</strong></div>
            </div>
            <div className="admin-modal-note">Detaliile complete ale comenzii sunt afișate în pagina Admin conectată la datele reale.</div>
            <div className="admin-modal-actions">
              <button className="admin-button" type="button" onClick={() => { setModal(null); setSelectedOrder(null); }}>Închide</button>
              <button className="admin-button admin-button-primary" type="button" onClick={() => { setModal(null); navigateTo("orders"); }}>Deschide comanda <ArrowRight size={13} /></button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}