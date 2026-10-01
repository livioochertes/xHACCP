const teamPhoto = "/__mockup/images/chef-home-participation-team-original.jpg";
const qrCode = "/__mockup/images/chef-home/original-qr.png";
const xhaccpLogo = "/__mockup/images/xhaccp-logo.png";

export function Participation() {
  return (
    <main className="part-export" data-export-root aria-label="xHACCP France — La Pétanque des Toqués, offre 2026">
      <section className="part-artboard">
        <figure className="part-photo">
          <img src={teamPhoto} alt="Les trois participants à La Pétanque des Toqués, à Antibes" />
        </figure>

        <header className="part-header">
          <img src={xhaccpLogo} alt="xHACCP France" />
          <div className="part-header-rule" />
          <p>Une rencontre entre chefs<br /><span>Antibes · 10e édition · 2026</span></p>
        </header>

        <section className="part-copy">
          <p className="part-eyebrow">La Pétanque des Toqués</p>
          <h1>Le goût de se<br /><em>retrouver.</em></h1>
          <p className="part-subtitle">xHACCP France célèbre les chefs de la Riviera.</p>

          <div className="part-offer">
            <strong>−20<span>%</span></strong>
            <div>
              <p>sur les produits xHACCP France</p>
              <b>pendant 1 an</b>
            </div>
          </div>

          <div className="part-terms">
            <span className="part-terms-mark" aria-hidden="true" />
            <p>Première commande validée sous 30 jours.<br />
              <span>Votre code personnel sera envoyé par e-mail.</span></p>
          </div>
        </section>

        <aside className="part-qr">
          <div className="part-qr-topline"><span /> L’OFFRE DES TOQUÉS</div>
          <div className="part-qr-card">
            <img src={qrCode} alt="QR code pour accéder à l’offre xHACCP France" />
            <p>Scannez pour<br /><strong>découvrir l’offre</strong></p>
            <a href="https://xhaccp.fr/chef-event">xhaccp.fr/chef-event</a>
          </div>
          <p className="part-eligibility">Participants, proches et<br />communauté de l’événement</p>
        </aside>

        <div className="part-edge-mark" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <style>{`
        .part-export {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #e7e5d9;
          color: #112f43;
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .part-export, .part-export * { box-sizing: border-box; }
        .part-artboard {
          position: relative;
          width: min(100vw, calc(100dvh * 3.121951));
          aspect-ratio: 1920 / 615;
          overflow: hidden;
          isolation: isolate;
          container-type: inline-size;
          background:
            radial-gradient(ellipse at 80% 0%, rgba(255,255,255,.72), transparent 38%),
            linear-gradient(113deg, #f5f1e5 0%, #f0eee3 56%, #e5eee9 100%);
        }
        .part-artboard::before {
          content: "";
          position: absolute;
          z-index: -1;
          inset: 0;
          opacity: .23;
          background-image:
            linear-gradient(rgba(17,47,67,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(17,47,67,.07) 1px, transparent 1px);
          background-size: 4.5cqw 4.5cqw;
          mask-image: linear-gradient(90deg, transparent 29%, #000 42%, transparent 79%);
        }
        .part-photo {
          position: absolute;
          inset: 0 auto 0 0;
          width: 28.73%;
          height: 100%;
          margin: 0;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: #d8e5e8;
          border-right: .28cqw solid #30a8b2;
        }
        .part-photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
        }
        .part-header {
          position: absolute;
          top: 7.6%;
          left: 32.7%;
          display: flex;
          align-items: center;
          gap: 1.05cqw;
        }
        .part-header img {
          display: block;
          width: 8.25cqw;
          height: 3.1cqw;
          object-fit: contain;
          object-position: left center;
        }
        .part-header-rule {
          width: 1px;
          height: 2.2cqw;
          background: rgba(20,73,88,.22);
        }
        .part-header p {
          margin: 0;
          color: #164655;
          font-size: .86cqw;
          line-height: 1.4;
          font-weight: 800;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .part-header p span {
          color: #63818a;
          font-size: .82em;
          font-weight: 600;
          letter-spacing: .08em;
        }
        .part-copy {
          position: absolute;
          left: 32.7%;
          top: 27.2%;
          width: 44%;
          color: #122f43;
        }
        .part-eyebrow {
          margin: 0 0 .42cqw;
          color: #16818b;
          font-size: .86cqw;
          font-weight: 800;
          letter-spacing: .22em;
          text-transform: uppercase;
        }
        .part-copy h1 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 4.7cqw;
          line-height: .87;
          font-weight: 700;
          letter-spacing: -.065em;
        }
        .part-copy h1 em {
          color: #177887;
          font-style: italic;
          font-weight: 600;
        }
        .part-subtitle {
          margin: .72cqw 0 0;
          color: #45616e;
          font-size: 1.06cqw;
          line-height: 1.35;
          font-weight: 600;
          letter-spacing: -.015em;
        }
        .part-offer {
          display: flex;
          align-items: center;
          gap: .82cqw;
          margin-top: .85cqw;
        }
        .part-offer strong {
          color: #bf861e;
          font-size: 3.55cqw;
          line-height: .9;
          letter-spacing: -.075em;
        }
        .part-offer strong span {
          margin-left: .04em;
          font-size: .67em;
        }
        .part-offer p {
          margin: 0 0 .12cqw;
          color: #254554;
          font-size: .93cqw;
          line-height: 1.25;
          font-weight: 700;
        }
        .part-offer b {
          color: #167b84;
          font-size: 1.12cqw;
          line-height: 1.2;
          font-weight: 800;
        }
        .part-terms {
          display: flex;
          align-items: center;
          gap: .58cqw;
          margin-top: .76cqw;
        }
        .part-terms-mark {
          flex: 0 0 auto;
          width: .36cqw;
          height: .36cqw;
          border-radius: 50%;
          background: #d2a13b;
          box-shadow: 0 0 0 .22cqw rgba(210,161,59,.15);
        }
        .part-terms p {
          margin: 0;
          color: #405c68;
          font-size: .75cqw;
          line-height: 1.42;
          font-weight: 700;
        }
        .part-terms p span {
          color: #69808a;
          font-weight: 500;
        }
        .part-qr {
          position: absolute;
          top: 13.4%;
          right: 3.15%;
          width: 16%;
          text-align: center;
        }
        .part-qr-topline {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .38cqw;
          margin-bottom: .55cqw;
          color: #43717b;
          font-size: .67cqw;
          font-weight: 800;
          letter-spacing: .17em;
        }
        .part-qr-topline span {
          width: .38cqw;
          height: .38cqw;
          border-radius: 50%;
          background: #d3a23f;
        }
        .part-qr-card {
          padding: .86cqw .9cqw .73cqw;
          border: 1px solid rgba(27,77,88,.13);
          border-radius: .78cqw;
          background: rgba(255,255,255,.82);
          box-shadow: 0 .65cqw 1.8cqw rgba(27,58,66,.1);
        }
        .part-qr-card img {
          display: block;
          width: 10.7cqw;
          height: 10.7cqw;
          margin: 0 auto;
          object-fit: contain;
        }
        .part-qr-card p {
          margin: .48cqw 0 .34cqw;
          color: #4f6770;
          font-size: .72cqw;
          line-height: 1.3;
        }
        .part-qr-card p strong {
          color: #173849;
          font-size: 1.05em;
          font-weight: 800;
        }
        .part-qr-card a {
          color: #147981;
          font-size: .7cqw;
          font-weight: 800;
          letter-spacing: .015em;
          text-decoration: none;
        }
        .part-eligibility {
          margin: .62cqw 0 0;
          color: #789099;
          font-size: .59cqw;
          font-weight: 600;
          line-height: 1.35;
        }
        .part-edge-mark {
          position: absolute;
          right: 21.6%;
          bottom: 9%;
          display: flex;
          gap: .34cqw;
          align-items: flex-end;
          opacity: .52;
        }
        .part-edge-mark i {
          display: block;
          width: .62cqw;
          height: .62cqw;
          border: 1px solid #ae832d;
          border-radius: 50%;
        }
        .part-edge-mark i:nth-child(2) {
          width: .82cqw;
          height: .82cqw;
          background: #237a8c;
          border-color: #237a8c;
        }
        @media (max-width: 650px) {
          .part-qr { right: 2.5%; width: 17%; }
          .part-copy { width: 45%; }
        }
      `}</style>
    </main>
  );
}