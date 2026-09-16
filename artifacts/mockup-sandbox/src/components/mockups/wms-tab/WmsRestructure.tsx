import { useState } from "react";
import "./_group.css";
import "./WmsRestructure.css";

type MarketCode = "RO" | "FR" | "COM";

const partners = [
  {
    id: 1,
    name: "MyFlyingBox",
    code: "mfb-fr",
    markets: ["FR"],
    keys: 2,
    active: true,
    endpoint: "api.myflyingbox.com",
    contact: "logistics@myflyingbox.com",
  },
  {
    id: 2,
    name: "Sameday",
    code: "sameday-ro",
    markets: ["RO"],
    keys: 1,
    active: true,
    endpoint: "api.sameday.ro",
    contact: "integrations@sameday.ro",
  },
  {
    id: 3,
    name: "Global Fulfillment",
    code: "global-com",
    markets: ["COM"],
    keys: 0,
    active: false,
    endpoint: "—",
    contact: "—",
  },
];

const marketplaceData: Record<MarketCode, {
  domain: string;
  status: "active" | "unconfigured";
  partnerId: number | null;
  note: string;
  origin?: {
    company: string;
    address: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
}> = {
  RO: {
    domain: ".ro",
    status: "active",
    partnerId: 2,
    note: "Comenzile din România sunt rutate către Sameday.",
  },
  FR: {
    domain: ".fr",
    status: "active",
    partnerId: 1,
    note: "Comenzile din Franța sunt rutate către MyFlyingBox și folosesc originea logistică de mai jos.",
    origin: {
      company: "Yetique SAS",
      address: "12 Rue de Paris",
      city: "Paris",
      region: "75",
      postal: "75001",
      country: "RO",
    },
  },
  COM: {
    domain: ".com",
    status: "unconfigured",
    partnerId: null,
    note: "Nu există încă o decizie de rutare pentru marketplace-ul internațional.",
  },
};

const marketLabels: Record<MarketCode, string> = {
  RO: "România",
  FR: "France",
  COM: "International",
};

export function WmsRestructure() {
  const [selectedPartnerId, setSelectedPartnerId] = useState(1);
  const [selectedMarket, setSelectedMarket] = useState<MarketCode>("FR");
  const [keyEnvironment, setKeyEnvironment] = useState("production");
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) ?? partners[0];
  const selectedMarketData = marketplaceData[selectedMarket];
  const selectedMarketPartner = partners.find((partner) => partner.id === selectedMarketData.partnerId);

  return (
    <main className="wms-preview wms-restructure">
      <div className="page-shell">
        <header className="page-header">
          <div>
            <h1>Parteneri WMS</h1>
            <p>Configurează separat marketplace-urile și furnizorii lor, fără să amesteci setările de rutare cu datele de integrare.</p>
          </div>
          <button className="btn btn-primary">↻ Reîncarcă</button>
        </header>

        <section className="section-card">
          <div className="section-heading">
            <div>
              <h2>Marketplace-uri</h2>
              <p>Tot ce ține de un marketplace este grupat aici: rutare, furnizor, status și origine logistică.</p>
            </div>
            <span className={`status-pill ${Object.values(marketplaceData).every((market) => market.status === "active") ? "success" : "warning"}`}>
              1 neconfigurat
            </span>
          </div>

          <div className="market-workspace">
            <nav className="market-list" aria-label="Marketplace-uri">
              {(Object.keys(marketplaceData) as MarketCode[]).map((market) => {
                const data = marketplaceData[market];
                return (
                  <button
                    className={`market-card ${selectedMarket === market ? "selected" : ""}`}
                    key={market}
                    onClick={() => setSelectedMarket(market)}
                    type="button"
                  >
                    <span className="market-card-top">
                      <span className="market-code">{market}</span>
                      <span className={`status-pill ${data.status === "active" ? "success" : "warning"}`}>
                        {data.status === "active" ? "Activ" : "Neconfigurat"}
                      </span>
                    </span>
                    <span className="market-domain">{marketLabels[market]} · {data.domain}</span>
                  </button>
                );
              })}
            </nav>

            <article className="market-detail">
              <div className="market-detail-header">
                <div>
                  <h3>{selectedMarket} · {marketLabels[selectedMarket]}</h3>
                  <p>{selectedMarketData.note}</p>
                </div>
                <span className={`status-pill ${selectedMarketData.status === "active" ? "success" : "warning"}`}>
                  {selectedMarketData.status === "active" ? "Rutare activă" : "Decizie necesară"}
                </span>
              </div>

              <div className="market-detail-grid">
                <div className="detail-card">
                  <h4>Furnizor pentru {selectedMarket}</h4>
                  <p>Furnizorul ales pentru acest marketplace este vizibil împreună cu statusul și codul său.</p>
                  <select className="select" value={selectedMarketData.partnerId ?? ""} onChange={() => undefined}>
                    <option value="">Fără rutare</option>
                    {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name} · {partner.code}</option>)}
                  </select>
                  <label className="check" style={{ marginTop: 10 }}>
                    <input type="checkbox" checked={selectedMarketData.status === "active"} onChange={() => undefined} />
                    Rutare activă pentru {selectedMarket}
                  </label>
                </div>

                <div className="detail-card">
                  <h4>Rezumat furnizor</h4>
                  {selectedMarketPartner ? (
                    <>
                      <strong style={{ color: "#172b4d", display: "block", marginBottom: 5 }}>{selectedMarketPartner.name}</strong>
                      <span className="meta-text">{selectedMarketPartner.code} · {selectedMarketPartner.endpoint}</span>
                      <span className={`status-pill ${selectedMarketPartner.active ? "success" : "neutral"}`} style={{ display: "inline-flex", marginTop: 11 }}>
                        {selectedMarketPartner.active ? "Furnizor activ" : "Furnizor inactiv"}
                      </span>
                    </>
                  ) : (
                    <span className="meta-text">Nu există furnizor asociat.</span>
                  )}
                </div>

                {selectedMarketData.origin && (
                  <div className="detail-card full">
                    <h4>Origine logistică pentru {selectedMarket}</h4>
                    <p>Adresa de expediere aparține configurației marketplace-ului francez și este păstrată împreună cu celelalte setări ale lui.</p>
                    <div className="origin-summary">
                      <span>Companie<strong>{selectedMarketData.origin.company}</strong></span>
                      <span>Adresă<strong>{selectedMarketData.origin.address}</strong></span>
                      <span>Localitate<strong>{selectedMarketData.origin.city}</strong></span>
                      <span>Departament<strong>{selectedMarketData.origin.region}</strong></span>
                      <span>Cod poștal<strong>{selectedMarketData.origin.postal}</strong></span>
                      <span>Țară<strong>{selectedMarketData.origin.country}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="section-card">
          <div className="section-heading">
            <div>
              <h2>Furnizori de logistică</h2>
              <p>Selectează un furnizor pentru a vedea toate informațiile, marketplace-urile și cheile lui într-un singur loc.</p>
            </div>
            <span className="status-pill success">{partners.length} furnizori</span>
          </div>

          <div className="provider-workspace">
            <div className="provider-list">
              {partners.map((partner) => (
                <button
                  className={`provider-row ${selectedPartnerId === partner.id ? "selected" : ""}`}
                  key={partner.id}
                  onClick={() => setSelectedPartnerId(partner.id)}
                  type="button"
                >
                  <strong>{partner.name}</strong>
                  <span className="meta-text">{partner.code} · {partner.markets.join(", ")}</span>
                  <span className={`status-pill ${partner.active ? "success" : "neutral"}`}>
                    {partner.active ? "Activ" : "Inactiv"}
                  </span>
                </button>
              ))}
            </div>

            <article className="provider-details">
              <div className="provider-details-header">
                <div>
                  <h3>{selectedPartner.name}</h3>
                  <span className="meta-text">Cod furnizor: <strong>{selectedPartner.code}</strong></span>
                </div>
                <span className={`status-pill ${selectedPartner.active ? "success" : "neutral"}`}>
                  {selectedPartner.active ? "Furnizor activ" : "Furnizor inactiv"}
                </span>
              </div>

              <div className="provider-detail-grid">
                <div className="detail-card">
                  <h4>Marketplace-uri asociate</h4>
                  <p>Aceste marketplace-uri folosesc integrarea acestui furnizor.</p>
                  <div className="market-chip-row">
                    {selectedPartner.markets.map((market) => <span className="market-chip" key={market}>{market}</span>)}
                  </div>
                </div>

                <div className="detail-card">
                  <h4>Date integrare</h4>
                  <p><strong>Endpoint:</strong> {selectedPartner.endpoint}</p>
                  <p><strong>Contact:</strong> {selectedPartner.contact}</p>
                </div>

                <div className="detail-card">
                  <h4>Chei API · {selectedPartner.keys}</h4>
                  {selectedPartner.keys ? (
                    <>
                      <div className="key-row">
                        <span><code>mfb_4f82…</code> · Production</span>
                        <button className="btn btn-quiet" style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}>Revocă</button>
                      </div>
                      {selectedPartner.keys > 1 && (
                        <div className="key-row">
                          <span><code>mfb_8a10…</code> · Sandbox</span>
                          <button className="btn btn-quiet" style={{ minHeight: 30, padding: "0 9px", fontSize: 11 }}>Revocă</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="meta-text">Nu există chei pentru acest furnizor.</span>
                  )}
                </div>

                <div className="detail-card">
                  <h4>Generează cheie nouă</h4>
                  <select className="select" value={keyEnvironment} onChange={(event) => setKeyEnvironment(event.target.value)}>
                    <option value="production">Producție</option>
                    <option value="sandbox">Sandbox</option>
                  </select>
                  <button className="btn btn-purple" style={{ marginTop: 10, width: "100%" }}>Generează cheia</button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <div className="lower-grid">
          <section className="panel" style={{ padding: 20 }}>
            <div className="section-heading">
              <div><h3>Timeline comandă</h3><p>Monitorizare independentă de configurarea marketplace-urilor.</p></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="ID comandă intern admin" />
              <button className="btn btn-primary">Încarcă</button>
            </div>
            <div className="timeline-item">Așteaptă un ID pentru a încărca timeline-ul.</div>
          </section>
          <section className="panel" style={{ padding: 20 }}>
            <div className="section-heading">
              <div><h3>Ultimele requesturi WMS</h3><p>Monitorizare tehnică separată de setările comerciale.</p></div>
            </div>
            <div className="timeline-item"><strong>200</strong> · POST /shipments<br /><span className="muted">request-8e1 · astăzi, 10:42</span></div>
            <div className="timeline-item"><strong>401</strong> · GET /partners<br /><span className="muted">request-6b4 · astăzi, 09:18</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}