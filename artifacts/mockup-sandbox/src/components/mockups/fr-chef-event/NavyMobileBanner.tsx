import "./_group.css";

export function NavyMobileBanner() {
  return (
    <main className="fr-navy-mobile-export" aria-label="Offre xHACCP France pour La Pétanque des Toqués">
      <figure className="fr-navy-mobile-export__photo">
        <img
          src="/__mockup/images/chef-home/team.jpeg"
          alt="Les trois participants à La Pétanque des Toqués, à Antibes"
        />
        <figcaption>Antibes · 10e édition · 2026</figcaption>
      </figure>

      <section className="fr-navy-mobile-export__copy">
        <div className="fr-navy-mobile-export__brand">
          <img src="/__mockup/images/xhaccp-logo.png" alt="xHACCP France" />
          <p>
            France · Antibes 2026
            <span>Une rencontre entre chefs</span>
          </p>
        </div>

        <div className="fr-navy-mobile-export__message">
          <p className="fr-navy-mobile-export__eyebrow">
            La Pétanque des Toqués · 10e édition
          </p>
          <h1>
            Un avantage
            <br />
            <em>qui dure.</em>
          </h1>
        </div>

        <div className="fr-navy-mobile-export__offer">
          <strong>−20%</strong>
          <p>
            <b>Pendant 1 an</b>
            <span>sur les produits xHACCP France</span>
          </p>
        </div>

        <p className="fr-navy-mobile-export__terms">
          <span aria-hidden="true" />
          <span>
            Première commande validée sous 30 jours.
            <small>Votre code personnel sera envoyé par e-mail.</small>
          </span>
        </p>

        <div className="fr-navy-mobile-export__action">
          <a href="https://xhaccp.fr/chef-event">
            S’inscrire <span aria-hidden="true">→</span>
          </a>
          <p>Code de réduction envoyé par e-mail</p>
        </div>
      </section>

      <style>{`
        .fr-navy-mobile-export,
        .fr-navy-mobile-export * {
          box-sizing: border-box;
        }
        .fr-navy-mobile-export {
          display: grid;
          width: 100%;
          height: 360px;
          grid-template-rows: 128px minmax(0, 1fr);
          overflow: hidden;
          color: #f4f1e8;
          background: #061e31;
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .fr-navy-mobile-export__photo {
          position: relative;
          min-height: 0;
          margin: 0;
          overflow: hidden;
          background: #18374a;
        }
        .fr-navy-mobile-export__photo::after {
          position: absolute;
          inset: 0;
          background: linear-gradient(0deg, rgba(2,15,26,.62), transparent 58%);
          content: "";
        }
        .fr-navy-mobile-export__photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 35%;
        }
        .fr-navy-mobile-export__photo figcaption {
          position: absolute;
          z-index: 1;
          right: 13px;
          bottom: 9px;
          left: 13px;
          color: #fff;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: .1em;
          text-shadow: 0 1px 8px rgba(0,0,0,.45);
        }
        .fr-navy-mobile-export__copy {
          display: flex;
          min-height: 0;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px 15px 9px;
          background:
            radial-gradient(ellipse at 100% 0%, rgba(37,121,149,.2), transparent 50%),
            linear-gradient(145deg, #0c3047, #061e31);
        }
        .fr-navy-mobile-export__brand {
          display: flex;
          min-height: 22px;
          align-items: center;
          gap: 9px;
        }
        .fr-navy-mobile-export__brand img {
          display: block;
          width: 58px;
          max-height: 22px;
          padding: 3px 4px;
          border-radius: 4px;
          background: #fff;
          object-fit: contain;
        }
        .fr-navy-mobile-export__brand p {
          margin: 0;
          color: #e7e8e1;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .12em;
          line-height: 1.35;
          text-transform: uppercase;
        }
        .fr-navy-mobile-export__brand p span {
          display: block;
          margin-top: 2px;
          color: #a7bbc1;
          font-size: 6.5px;
          font-weight: 600;
          letter-spacing: .1em;
        }
        .fr-navy-mobile-export__eyebrow {
          margin: 0 0 4px;
          color: #78c8cc;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .14em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .fr-navy-mobile-export__message h1 {
          margin: 0;
          color: #f5f1e7;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 25px;
          font-weight: 700;
          letter-spacing: -.045em;
          line-height: .91;
        }
        .fr-navy-mobile-export__message h1 em {
          color: #8fd7d4;
          font-weight: 600;
        }
        .fr-navy-mobile-export__offer {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .fr-navy-mobile-export__offer > strong {
          color: #e3ad42;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 36px;
          letter-spacing: -.06em;
          line-height: .9;
          white-space: nowrap;
        }
        .fr-navy-mobile-export__offer p {
          margin: 0;
          color: #d3dfdc;
          font-size: 8px;
          line-height: 1.3;
        }
        .fr-navy-mobile-export__offer p b {
          display: block;
          margin-bottom: 2px;
          color: #e3ad42;
          font-size: 1.05em;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .fr-navy-mobile-export__terms {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin: 0;
          color: #c4d1d0;
          font-size: 7px;
          line-height: 1.35;
        }
        .fr-navy-mobile-export__terms > span:first-child {
          flex: 0 0 6px;
          width: 6px;
          height: 6px;
          margin-top: 2px;
          border-radius: 50%;
          background: #e2ad44;
        }
        .fr-navy-mobile-export__terms small {
          display: block;
          color: #8ea8ae;
          font-size: inherit;
        }
        .fr-navy-mobile-export__action {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .fr-navy-mobile-export__action a {
          display: inline-flex;
          min-height: 29px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          flex: 0 0 auto;
          padding: 0 14px;
          border: 1px solid rgba(143,215,212,.3);
          border-radius: 999px;
          background: #123c55;
          color: #f7f3e9;
          font-size: 9px;
          font-weight: 800;
          text-decoration: none;
        }
        .fr-navy-mobile-export__action p {
          max-width: 140px;
          margin: 0;
          color: #a9c0c2;
          font-size: 7px;
          line-height: 1.25;
        }
      `}</style>
    </main>
  );
}