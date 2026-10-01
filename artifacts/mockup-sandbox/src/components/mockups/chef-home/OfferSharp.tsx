const teamPhoto = "/__mockup/images/chef-home-offer-sharp-team-original.jpg";
const qrCode = "/__mockup/images/chef-home/original-qr.png";
const xhaccpLogo = "/__mockup/images/xhaccp-logo.png";

export function OfferSharp() {
  return (
    <main className="offer-sharp-export" data-export-root aria-label="xHACCP France — Offre chefs, La Pétanque des Toqués 2026">
      <section className="offer-sharp-artboard">
        <figure className="offer-sharp-photo">
          <img src={teamPhoto} alt="Les trois participants à La Pétanque des Toqués, à Antibes" />
        </figure>

        <header className="offer-sharp-header">
          <img src={xhaccpLogo} alt="xHACCP France" />
          <span className="offer-sharp-divider" aria-hidden="true" />
          <p>France <span>·</span> Antibes 2026</p>
          <b>OFFRE SPÉCIALE CHEFS</b>
        </header>

        <section className="offer-sharp-copy">
          <p className="offer-sharp-eyebrow">La Pétanque des Toqués · 10e édition</p>
          <h1>Un avantage<br /><em>qui dure.</em></h1>
          <div className="offer-sharp-deal">
            <strong>−20<span>%</span></strong>
            <div>
              <b>PENDANT 1 AN</b>
              <p>sur les produits xHACCP France</p>
            </div>
          </div>
          <div className="offer-sharp-rule" />
          <p className="offer-sharp-condition">
            Première commande validée sous 30 jours
            <span>Votre code personnel vous sera envoyé par e-mail.</span>
          </p>
        </section>

        <aside className="offer-sharp-qr">
          <div className="offer-sharp-qr-card">
            <div className="offer-sharp-qr-frame"><img src={qrCode} alt="QR code vers l’offre du Chef Event" /></div>
            <p>SCANNER POUR<br /><strong>VOUS INSCRIRE</strong></p>
            <a href="https://xhaccp.fr/chef-event">xhaccp.fr/chef-event</a>
          </div>
          <p className="offer-sharp-qr-note">Code de réduction envoyé par e-mail</p>
        </aside>

        <div className="offer-sharp-accent" aria-hidden="true" />
      </section>

      <style>{`
        .offer-sharp-export {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #061728;
          color: #f6f8f5;
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .offer-sharp-export, .offer-sharp-export * { box-sizing: border-box; }
        .offer-sharp-artboard {
          position: relative;
          width: min(100vw, calc(100dvh * 3.121951));
          aspect-ratio: 1920 / 615;
          overflow: hidden;
          isolation: isolate;
          container-type: inline-size;
          background:
            radial-gradient(ellipse at 72% 10%, rgba(31,123,145,.2), transparent 45%),
            linear-gradient(107deg, #09243a 0%, #082d45 59%, #062035 100%);
        }
        .offer-sharp-artboard::before {
          content: "";
          position: absolute;
          z-index: -1;
          inset: 0;
          opacity: .2;
          background-image:
            linear-gradient(rgba(170,220,225,.09) 1px, transparent 1px),
            linear-gradient(90deg, rgba(170,220,225,.09) 1px, transparent 1px);
          background-size: 4.6cqw 4.6cqw;
          mask-image: linear-gradient(90deg, transparent 28%, #000 39%, #000 85%, transparent);
        }
        .offer-sharp-photo {
          position: absolute;
          inset: 0 auto 0 0;
          display: grid;
          place-items: center;
          width: 28.73%;
          height: 100%;
          margin: 0;
          overflow: hidden;
          border-right: .28cqw solid #45c2d0;
          background: #c5dce3;
        }
        .offer-sharp-photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
        }
        .offer-sharp-header {
          position: absolute;
          top: 7.4%;
          left: 32.7%;
          right: 3.3%;
          display: flex;
          align-items: center;
          gap: .9cqw;
          min-height: 3.2cqw;
        }
        .offer-sharp-header img {
          display: block;
          width: 7.7cqw;
          height: 3.1cqw;
          object-fit: contain;
          object-position: left center;
        }
        .offer-sharp-divider {
          width: 1px;
          height: 1.9cqw;
          background: rgba(203,231,235,.25);
        }
        .offer-sharp-header p {
          margin: 0;
          color: #c6d7de;
          font-size: 1.02cqw;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .offer-sharp-header p span { color: #e4b955; padding: 0 .32cqw; }
        .offer-sharp-header > b {
          margin-left: auto;
          padding: .48cqw .72cqw;
          border: 1px solid rgba(112,202,215,.35);
          border-radius: 99px;
          color: #91d7dd;
          font-size: .9cqw;
          letter-spacing: .16em;
        }
        .offer-sharp-copy {
          position: absolute;
          top: 25.4%;
          left: 32.7%;
          width: 44.2%;
        }
        .offer-sharp-eyebrow {
          margin: 0 0 .62cqw;
          color: #80cbd1;
          font-size: 1.18cqw;
          font-weight: 800;
          letter-spacing: .21em;
          text-transform: uppercase;
        }
        .offer-sharp-copy h1 {
          margin: 0;
          color: #f4f6f2;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 4.18cqw;
          line-height: .87;
          letter-spacing: -.06em;
          font-weight: 700;
        }
        .offer-sharp-copy h1 em {
          color: #65c9d0;
          font-style: italic;
          font-weight: 600;
        }
        .offer-sharp-deal {
          display: flex;
          align-items: center;
          gap: .9cqw;
          margin-top: .85cqw;
        }
        .offer-sharp-deal > strong {
          color: #e4b955;
          font-size: 4.45cqw;
          line-height: .9;
          letter-spacing: -.075em;
        }
        .offer-sharp-deal > strong span { font-size: .65em; }
        .offer-sharp-deal b {
          color: #f3f7f4;
          font-size: 1.25cqw;
          font-weight: 900;
          letter-spacing: .15em;
        }
        .offer-sharp-deal p {
          margin: .3cqw 0 0;
          color: #c0d6de;
          font-size: 1.15cqw;
          font-weight: 500;
        }
        .offer-sharp-rule {
          width: 33%;
          height: 1px;
          margin: .72cqw 0 .55cqw;
          background: linear-gradient(90deg, #55c3ce, rgba(85,195,206,0));
        }
        .offer-sharp-condition {
          margin: 0;
          color: #f0f5f3;
          font-size: 1.15cqw;
          font-weight: 700;
          line-height: 1.45;
        }
        .offer-sharp-condition span {
          display: block;
          color: #a8c3cd;
          font-size: .91em;
          font-weight: 500;
        }
        .offer-sharp-qr {
          position: absolute;
          top: 16.3%;
          right: 3.15%;
          width: 16%;
          text-align: center;
        }
        .offer-sharp-qr-card {
          padding: .72cqw .83cqw .7cqw;
          border-radius: .72cqw;
          background: #fbfcf9;
          box-shadow: 0 .82cqw 2.1cqw rgba(0,0,0,.26);
          color: #142e3b;
        }
        .offer-sharp-qr-frame {
          display: grid;
          place-items: center;
          width: 10.9cqw;
          height: 10.9cqw;
          margin: 0 auto .56cqw;
          background: #fff;
        }
        .offer-sharp-qr-frame img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
        .offer-sharp-qr-card p {
          margin: 0 0 .38cqw;
          color: #627983;
          font-size: 1cqw;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: .13em;
        }
        .offer-sharp-qr-card p strong {
          color: #173646;
          font-size: 1.05em;
          font-weight: 900;
        }
        .offer-sharp-qr-card a {
          color: #147d85;
          font-size: .95cqw;
          font-weight: 800;
          letter-spacing: .015em;
          text-decoration: none;
        }
        .offer-sharp-qr-note {
          margin: .6cqw 0 0;
          color: #a8c6ce;
          font-size: .95cqw;
          font-weight: 600;
        }
        .offer-sharp-accent {
          position: absolute;
          right: 20.6%;
          bottom: 8.5%;
          width: .62cqw;
          height: .62cqw;
          border: 1px solid rgba(226,185,85,.65);
          border-radius: 50%;
          box-shadow: -1.15cqw -.35cqw 0 -.08cqw #174c61, -2.3cqw 0 0 -.08cqw rgba(226,185,85,.55);
          opacity: .72;
        }
      `}</style>
    </main>
  );
}