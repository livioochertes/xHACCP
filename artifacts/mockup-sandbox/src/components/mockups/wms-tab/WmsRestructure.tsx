import { useState } from "react";
import "./_group.css";

const partners = [
  { id: 1, name: "MyFlyingBox", code: "mfb-fr", markets: ["FR"], keys: 2, active: true },
  { id: 2, name: "Sameday", code: "sameday-ro", markets: ["RO"], keys: 1, active: true },
  { id: 3, name: "Global Fulfillment", code: "global-com", markets: ["COM"], keys: 0, active: false },
];

const routes = {
  RO: { partner: "Sameday", state: "active" },
  FR: { partner: "MyFlyingBox", state: "active" },
  COM: { partner: "", state: "unconfigured" },
};

export function WmsRestructure() {
  const [selectedPartnerId, setSelectedPartnerId] = useState(1);
  const [selectedMarket, setSelectedMarket] = useState<keyof typeof routes>("FR");
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) ?? partners[0];
  const route = routes[selectedMarket];

  return (
    <main className="wms-preview">
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        <header className="section-heading">
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 5 }}>Parteneri WMS</h1>
            <p>Gestionează furnizorii logistici, configurarea lor și rutarea pe fiecare marketplace.</p>
          </div>
          <button className="btn btn-primary">↻ Reîncarcă</button>
        </header>

        <section className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Furnizori de logistică</h2>
              <p>Selectează un furnizor pentru a vedea cheile și informațiile aferente lui.</p>
            </div>
            <span className="status-pill success">3 furnizori</span>
          </div>

          <div className="provider-layout">
            <div>
              <div className="provider-list">
                {partners.map((partner) => (
                  <button
                    className={`provider-row ${selectedPartnerId === partner.id ? "selected" : ""}`}
                    key={partner.id}
                    onClick={() => setSelectedPartnerId(partner.id)}
                  >
                    <strong>{partner.name}</strong>
                    <span className="provider-meta">{partner.code} · {partner.markets.join(", ")}</span>
                    <span className="provider-status">{partner.active ? "Activ" : "Inactiv"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel" style={{ boxShadow: "none", padding: 16, background: "#fbfdff" }}>
              <div className="detail-top">
                <div>
                  <h3 style={{ fontSize: 16 }}>{selectedPartner.name}</h3>
                  <div className="detail-line">Cod furnizor: <strong>{selectedPartner.code}</strong></div>
                </div>
                <span className={`status-pill ${selectedPartner.active ? "success" : "warning"}`}>
                  {selectedPartner.active ? "Activ" : "Inactiv"}
                </span>
              </div>

              <div className="detail-line">Marketplace-uri asociate: {selectedPartner.markets.join(", ") || "—"}</div>
              <div className="key-list">
                <strong style={{ color: "#172b4d", fontSize: 13 }}>Chei API</strong>
                {selectedPartner.keys ? (
                  <div className="key-row">
                    <span><code>mfb_4f82…</code> · Production</span>
                    <button className="btn btn-quiet" style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}>Revocă</button>
                  </div>
                ) : (
                  <div className="detail-line">Nu există chei pentru acest furnizor.</div>
                )}
              </div>
            </div>

            <div className="panel" style={{ boxShadow: "none", padding: 16 }}>
              <strong style={{ display: "block", color: "#172b4d", marginBottom: 12 }}>Cheie nouă</strong>
              <label className="label">Furnizor
                <select className="select" value={selectedPartnerId} onChange={(event) => setSelectedPartnerId(Number(event.target.value))}>
                  {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
                </select>
              </label>
              <label className="label">Mediu
                <select className="select">
                  <option>Producție</option>
                  <option>Sandbox</option>
                </select>
              </label>
              <button className="btn btn-purple" style={{ marginTop: 13, width: "100%" }}>Generează cheia</button>
            </div>
          </div>
        </section>

        <section className="panel" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Rutare marketplace</h2>
              <p>Configurează separat partenerul și statusul pentru marketplace-ul selectat.</p>
            </div>
            <span className="status-pill warning">1 neconfigurat</span>
          </div>
          <div className="routing-panel">
            <div className="market-tabs">
              {(Object.keys(routes) as Array<keyof typeof routes>).map((market) => (
                <button className={`market-tab ${selectedMarket === market ? "selected" : ""}`} key={market} onClick={() => setSelectedMarket(market)}>
                  <span>{market}</span>
                  <span className={`status-pill ${routes[market].state === "active" ? "success" : "warning"}`}>
                    {routes[market].state === "active" ? "Activ" : "Neconfigurat"}
                  </span>
                </button>
              ))}
            </div>
            <div className="routing-content">
              <h3>{selectedMarket} · Rutare</h3>
              <p>Aceste setări se aplică numai comenzilor din marketplace-ul {selectedMarket}.</p>
              <div className="routing-fields">
                <label className="label">Furnizor logistic
                  <select className="select" value={route.partner} onChange={() => undefined}>
                    <option value="">Fără rutare</option>
                    {partners.map((partner) => <option key={partner.id}>{partner.name}</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={route.state === "active"} onChange={() => undefined} /> Rutare activă</label>
              </div>
            </div>
          </div>
        </section>

        <section className="panel origin" style={{ padding: 20, marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ fontSize: 17 }}>Origine logistică MyFlyingBox · .fr</h2>
              <p>Adresa de expediere este o setare operațională separată de furnizorii și rutarea marketplace-urilor.</p>
            </div>
            <span className="status-pill success">Configurată</span>
          </div>
          <div className="origin-grid">
            <label className="label wide">Nume firmă logistică<input className="input" value="Yetique SAS" readOnly /></label>
            <label className="label wide">Adresă / stradă<input className="input" value="12 Rue de Paris" readOnly /></label>
            <label className="label">Localitate<input className="input" value="Paris" readOnly /></label>
            <label className="label">Cod poștal<input className="input" value="75001" readOnly /></label>
            <label className="label">Departament / regiune<input className="input" value="75" readOnly /></label>
            <label className="label">Țară<input className="input" value="RO" readOnly /></label>
          </div>
        </section>

        <div className="lower-grid">
          <section className="panel" style={{ padding: 20 }}>
            <div className="section-heading"><div><h2 style={{ fontSize: 16 }}>Timeline comandă</h2><p>Verifică rapid statusul unei comenzi.</p></div></div>
            <div style={{ display: "flex", gap: 8 }}><input className="input" placeholder="ID comandă intern admin" /><button className="btn btn-primary">Încarcă</button></div>
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