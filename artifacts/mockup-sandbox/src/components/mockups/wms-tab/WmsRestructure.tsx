import { useState } from "react";
import "./_group.css";

type Market = "RO" | "FR" | "COM";

type Provider = {
  id: string;
  name: string;
  code: string;
  markets: Market[];
  keys: number;
  active: boolean;
};

const logisticsProviders: Provider[] = [
  { id: "sls-ro", name: "SLS Cargo", code: "sls-ro", markets: ["RO"], keys: 1, active: true },
  { id: "saint-laurent-fr", name: "Saint Laurent Logistic", code: "sll-fr", markets: ["FR"], keys: 2, active: true },
  { id: "global-com", name: "Global Fulfillment", code: "global-com", markets: ["COM"], keys: 0, active: false },
];

const courierProviders: Provider[] = [
  { id: "sameday-ro", name: "Sameday", code: "sameday-ro", markets: ["RO"], keys: 1, active: true },
  { id: "myflyingbox-fr", name: "MyFlyingBox", code: "mfb-fr", markets: ["FR"], keys: 2, active: true },
  { id: "global-courier-com", name: "Global Courier", code: "global-courier", markets: ["COM"], keys: 0, active: false },
];

const initialRoutes: Record<Market, {
  logisticsProviderId: string;
  courierProviderId: string;
  active: boolean;
}> = {
  RO: { logisticsProviderId: "sls-ro", courierProviderId: "sameday-ro", active: true },
  FR: { logisticsProviderId: "saint-laurent-fr", courierProviderId: "myflyingbox-fr", active: true },
  COM: { logisticsProviderId: "", courierProviderId: "", active: false },
};

const originByMarket: Record<Market, {
  provider: string;
  company: string;
  address: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
}> = {
  RO: {
    provider: "SLS Cargo",
    company: "SLS Cargo România",
    address: "Strada Industriilor 12",
    city: "București",
    postalCode: "032901",
    state: "București",
    country: "RO",
  },
  FR: {
    provider: "Saint Laurent Logistic",
    company: "Saint Laurent Logistic SAS",
    address: "12 Rue de Paris",
    city: "Paris",
    postalCode: "75001",
    state: "75",
    country: "FR",
  },
  COM: {
    provider: "Neconfigurat",
    company: "—",
    address: "—",
    city: "—",
    postalCode: "—",
    state: "—",
    country: "—",
  },
};

function ProviderGroup({
  title,
  description,
  providers,
  selectedId,
  onSelect,
}: {
  title: string;
  description: string;
  providers: Provider[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selectedProvider = providers.find((provider) => provider.id === selectedId) ?? providers[0];

  return (
    <div className="provider-role-card">
      <div className="role-heading">
        <div>
          <span className="role-eyebrow">Rol WMS</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="status-pill success">{providers.filter((provider) => provider.active).length} activi</span>
      </div>
      <div className="provider-role-content">
        <div className="provider-list">
          {providers.map((provider) => (
            <button
              type="button"
              className={`provider-row ${selectedId === provider.id ? "selected" : ""}`}
              key={provider.id}
              onClick={() => onSelect(provider.id)}
            >
              <strong>{provider.name}</strong>
              <span className="provider-meta">{provider.code} · {provider.markets.join(", ")}</span>
              <span className={`provider-status ${provider.active ? "" : "inactive"}`}>
                {provider.active ? "Activ" : "Inactiv"}
              </span>
            </button>
          ))}
        </div>
        <div className="provider-inspector">
          <div className="detail-top">
            <div>
              <span className="role-eyebrow">Furnizor selectat</span>
              <h3>{selectedProvider.name}</h3>
              <div className="detail-line">Cod furnizor: <strong>{selectedProvider.code}</strong></div>
            </div>
            <span className={`status-pill ${selectedProvider.active ? "success" : "warning"}`}>
              {selectedProvider.active ? "Activ" : "Inactiv"}
            </span>
          </div>
          <div className="detail-line">Marketplace-uri asociate: {selectedProvider.markets.join(", ") || "—"}</div>
          <div className="key-list">
            <strong style={{ color: "#172b4d", fontSize: 13 }}>Chei API</strong>
            {selectedProvider.keys ? (
              <div className="key-row">
                <span><code>{selectedProvider.code}_4f82…</code> · Production</span>
                <button type="button" className="btn btn-quiet" style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}>Revocă</button>
              </div>
            ) : (
              <div className="detail-line">Nu există chei pentru acest furnizor.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WmsRestructure() {
  const [selectedLogisticsProviderId, setSelectedLogisticsProviderId] = useState("sls-ro");
  const [selectedCourierProviderId, setSelectedCourierProviderId] = useState("sameday-ro");
  const [selectedMarket, setSelectedMarket] = useState<Market>("RO");
  const [marketRoutes, setMarketRoutes] = useState(initialRoutes);
  const route = marketRoutes[selectedMarket];
  const origin = originByMarket[selectedMarket];
  const marketLogisticsProviders = logisticsProviders.filter((provider) => provider.markets.includes(selectedMarket));
  const marketCourierProviders = courierProviders.filter((provider) => provider.markets.includes(selectedMarket));
  const routeConfigured = Boolean(route.logisticsProviderId && route.courierProviderId && route.active);

  const updateRoute = (field: "logisticsProviderId" | "courierProviderId", value: string) => {
    setMarketRoutes((current) => ({
      ...current,
      [selectedMarket]: { ...current[selectedMarket], [field]: value },
    }));
  };

  return (
    <main className="wms-preview">
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <header className="section-heading">
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 5 }}>Parteneri WMS</h1>
            <p>Gestionează separat depozitul logistic, curieratul și rutarea comenzilor pe fiecare marketplace.</p>
          </div>
          <button type="button" className="btn btn-primary">↻ Reîncarcă</button>
        </header>

        <section className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Furnizori de servicii</h2>
              <p>Separă furnizorul care operează logistica de furnizorul care transportă coletele și generează AWB-ul.</p>
            </div>
            <span className="status-pill success">2 roluri distincte</span>
          </div>

          <div className="provider-role-grid">
            <ProviderGroup
              title="Furnizori de servicii logistice"
              description="Depozitare, pregătire și predare a coletelor către curier."
              providers={logisticsProviders}
              selectedId={selectedLogisticsProviderId}
              onSelect={setSelectedLogisticsProviderId}
            />
            <ProviderGroup
              title="Furnizori de servicii de curierat"
              description="Transportul coletului, AWB-ul și urmărirea livrării."
              providers={courierProviders}
              selectedId={selectedCourierProviderId}
              onSelect={setSelectedCourierProviderId}
            />
          </div>
        </section>

        <section className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Rutare marketplace</h2>
              <p>Alege separat serviciul logistic și curierul folosit pentru comenzile marketplace-ului selectat.</p>
            </div>
            <span className={`status-pill ${routeConfigured ? "success" : "warning"}`}>
              {routeConfigured ? "3 marketplace-uri urmărite" : "Necesită configurare"}
            </span>
          </div>
          <div className="routing-panel">
            <div className="market-tabs">
              {(Object.keys(marketRoutes) as Market[]).map((market) => {
                const marketRoute = marketRoutes[market];
                const configured = Boolean(marketRoute.logisticsProviderId && marketRoute.courierProviderId && marketRoute.active);
                return (
                <button className={`market-tab ${selectedMarket === market ? "selected" : ""}`} key={market} onClick={() => setSelectedMarket(market)}>
                  <span>{market}</span>
                  <span className={`status-pill ${configured ? "success" : "warning"}`}>
                    {configured ? "Activ" : "Neconfigurat"}
                  </span>
                </button>
                );
              })}
            </div>
            <div className="routing-content">
              <h3>{selectedMarket} · Rutare</h3>
              <p>Aceste setări se aplică numai comenzilor din marketplace-ul {selectedMarket}. Cele două roluri rămân independente.</p>
              <div className="routing-fields">
                <label className="label">Furnizor servicii logistice
                  <select className="select" value={route.logisticsProviderId} onChange={(event) => updateRoute("logisticsProviderId", event.target.value)}>
                    <option value="">Fără furnizor logistic</option>
                    {marketLogisticsProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <label className="label">Furnizor servicii de curierat
                  <select className="select" value={route.courierProviderId} onChange={(event) => updateRoute("courierProviderId", event.target.value)}>
                    <option value="">Fără furnizor de curierat</option>
                    {marketCourierProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={route.active} onChange={(event) => setMarketRoutes((current) => ({ ...current, [selectedMarket]: { ...current[selectedMarket], active: event.target.checked } }))} /> Rutare activă</label>
              </div>
            </div>
          </div>
        </section>

        <section className="panel origin" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Origine logistică {origin.provider} · .{selectedMarket.toLowerCase()}</h2>
              <p>Adresa de expediere aparține furnizorului logistic și este separată de furnizorul de curierat.</p>
            </div>
            <span className={`status-pill ${selectedMarket === "COM" ? "warning" : "success"}`}>
              {selectedMarket === "COM" ? "Neconfigurată" : "Configurată"}
            </span>
          </div>
          <div className="origin-grid">
            <label className="label wide">Nume firmă logistică<input className="input" value={origin.company} readOnly /></label>
            <label className="label wide">Adresă / stradă<input className="input" value={origin.address} readOnly /></label>
            <label className="label">Localitate<input className="input" value={origin.city} readOnly /></label>
            <label className="label">Cod poștal<input className="input" value={origin.postalCode} readOnly /></label>
            <label className="label">Departament / regiune<input className="input" value={origin.state} readOnly /></label>
            <label className="label">Țară<input className="input" value={origin.country} readOnly /></label>
          </div>
        </section>

        <div className="lower-grid">
          <section className="panel" style={{ padding: 20 }}>
            <div className="section-heading"><div><h2 style={{ fontSize: 16 }}>Timeline comandă</h2><p>Verifică rapid statusul unei comenzi.</p></div></div>
            <div style={{ display: "flex", gap: 8 }}><input className="input" placeholder="ID comandă intern admin" /><button type="button" className="btn btn-primary">Încarcă</button></div>
            <div className="timeline-item">Așteaptă un ID pentru a încărca timeline-ul.</div>
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <div className="section-heading"><div><h2 style={{ fontSize: 16 }}>Ultimele requesturi WMS</h2><p>Monitorizare tehnică, separată de configurare.</p></div></div>
            <div className="timeline-item"><strong>200</strong> · POST /shipments<br /><span className="muted">request-8e1 · astăzi, 10:42</span></div>
            <div className="timeline-item"><strong>401</strong> · GET /partners<br /><span className="muted">request-6b4 · astăzi, 09:18</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}