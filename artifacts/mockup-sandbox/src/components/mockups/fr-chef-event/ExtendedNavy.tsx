import "./_group.css";

export function ExtendedNavy() {
  return (
    <main className="fr-extended-navy" aria-label="xHACCP France — La Pétanque des Toqués">
      <section className="fr-extended-navy__hero" aria-label="Offre spéciale chefs">
        <figure className="fr-extended-navy__photo">
          <img
            src="/__mockup/images/chef-home/team.jpeg"
            alt="Les trois participants à La Pétanque des Toqués, à Antibes"
          />
          <figcaption>Antibes · 10e édition · 2026</figcaption>
        </figure>

        <section
          className="fr-extended-navy__copy"
          aria-labelledby="fr-extended-navy-title"
        >
          <div className="fr-extended-navy__brand">
            <img src="/__mockup/images/xhaccp-logo.png" alt="xHACCP France" />
            <p>
              France · Antibes 2026
              <span>Une rencontre entre chefs</span>
            </p>
          </div>

          <p className="fr-extended-navy__eyebrow">
            La Pétanque des Toqués · 10e édition
          </p>
          <h1 id="fr-extended-navy-title">
            Un avantage
            <br />
            <em>qui dure.</em>
          </h1>

          <div className="fr-extended-navy__offer">
            <strong>−20<span>%</span></strong>
            <p>
              <b>pendant 1 an</b>
              sur les produits xHACCP France
            </p>
          </div>

          <p className="fr-extended-navy__terms">
            <span aria-hidden="true" />
            <span>
              Première commande validée sous 30 jours.
              <small>Votre code personnel sera envoyé par e-mail.</small>
            </span>
          </p>
        </section>

        <aside className="fr-extended-navy__action" aria-label="Inscription à l’offre">
          <p className="fr-extended-navy__action-label">
            <span aria-hidden="true" />
            Offre spéciale chefs
          </p>
          <div className="fr-extended-navy__qr-frame">
            <img
              src="/__mockup/images/chef-home/original-qr.png"
              alt="QR code xHACCP France pour vous inscrire à l’offre"
            />
          </div>
          <p className="fr-extended-navy__qr-caption">
            Scanner pour
            <strong>vous inscrire</strong>
          </p>
          <a className="fr-extended-navy__url" href="https://xhaccp.fr/chef-event">
            xhaccp.fr/chef-event
          </a>
          <a
            className="fr-extended-navy__mobile-cta"
            href="https://xhaccp.fr/chef-event"
            aria-label="S’inscrire à l’offre xHACCP France"
          >
            S’inscrire <span aria-hidden="true">→</span>
          </a>
          <p className="fr-extended-navy__mobile-caption">
            Code de réduction envoyé par e-mail
          </p>
          <p className="fr-extended-navy__eligibility">
            Code de réduction envoyé par e-mail
          </p>
        </aside>
      </section>

      <style>{`
        .fr-extended-navy {
          width: 100%;
          color: #f4f1e8;
          background: #061e31;
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .fr-extended-navy,
        .fr-extended-navy * { box-sizing: border-box; }
        .fr-extended-navy__hero {
          display: grid;
          grid-template-columns: minmax(0, .92fr) minmax(0, 1.6fr) minmax(0, .82fr);
          gap: 12px;
          width: 100%;
          height: 410px;
          padding: 12px;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 80% 0%, rgba(37,121,149,.23), transparent 38%),
            linear-gradient(116deg, #061e31 0%, #0a2b44 57%, #071f34 100%);
        }
        .fr-extended-navy__photo,
        .fr-extended-navy__copy,
        .fr-extended-navy__action {
          min-width: 0;
          min-height: 0;
          margin: 0;
          overflow: hidden;
          border: 1px solid rgba(155,201,207,.2);
          border-radius: 18px;
          box-shadow: 0 14px 34px rgba(0,10,21,.28);
        }
        .fr-extended-navy__photo {
          position: relative;
          isolation: isolate;
          background: #18374a;
        }
        .fr-extended-navy__photo::after {
          position: absolute;
          inset: 38% 0 0;
          z-index: 0;
          background: linear-gradient(transparent, rgba(2,15,26,.72));
          content: "";
        }
        .fr-extended-navy__photo img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 46%;
        }
        .fr-extended-navy__photo figcaption {
          position: absolute;
          z-index: 1;
          right: 16px;
          bottom: 15px;
          left: 16px;
          color: #fff;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .1em;
          text-shadow: 0 1px 8px rgba(0,0,0,.4);
        }
        .fr-extended-navy__copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(18px, 2vw, 32px);
          background:
            radial-gradient(ellipse at 92% 6%, rgba(53,127,150,.17), transparent 42%),
            linear-gradient(145deg, rgba(12,48,71,.97), rgba(5,30,49,.98));
        }
        .fr-extended-navy__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 13px;
        }
        .fr-extended-navy__brand img {
          display: block;
          width: 76px;
          max-height: 32px;
          padding: 4px 5px;
          border-radius: 5px;
          background: #fff;
          object-fit: contain;
        }
        .fr-extended-navy__brand p {
          margin: 0;
          color: #e7e8e1;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .13em;
          line-height: 1.35;
          text-transform: uppercase;
        }
        .fr-extended-navy__brand p span {
          display: block;
          margin-top: 3px;
          color: #a7bbc1;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: .11em;
        }
        .fr-extended-navy__eyebrow {
          margin: 0 0 6px;
          color: #78c8cc;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .fr-extended-navy__copy h1 {
          margin: 0;
          color: #f5f1e7;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(31px, 2.3vw, 40px);
          font-weight: 700;
          letter-spacing: -.045em;
          line-height: .94;
        }
        .fr-extended-navy__copy h1 em {
          color: #8fd7d4;
          font-weight: 600;
        }
        .fr-extended-navy__offer {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 10px;
        }
        .fr-extended-navy__offer > strong {
          color: #e3ad42;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(36px, 2.75vw, 47px);
          letter-spacing: -.06em;
          line-height: .9;
          white-space: nowrap;
        }
        .fr-extended-navy__offer > strong span {
          margin-left: 1px;
          font-size: .57em;
        }
        .fr-extended-navy__offer p {
          margin: 0;
          color: #d3dfdc;
          font-size: clamp(10px, .83vw, 12px);
          line-height: 1.3;
        }
        .fr-extended-navy__offer p b {
          display: block;
          margin-bottom: 2px;
          color: #e3ad42;
          font-size: 1.05em;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .fr-extended-navy__terms {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 10px 0 0;
          color: #c4d1d0;
          font-size: 9px;
          line-height: 1.4;
        }
        .fr-extended-navy__terms > span:first-child {
          flex: 0 0 7px;
          width: 7px;
          height: 7px;
          margin-top: 3px;
          border-radius: 50%;
          background: #e2ad44;
        }
        .fr-extended-navy__terms small {
          display: block;
          color: #8ea8ae;
          font-size: inherit;
        }
        .fr-extended-navy__action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 15px;
          border-color: rgba(168,210,212,.24);
          background:
            radial-gradient(ellipse at 50% 2%, rgba(255,255,255,.07), transparent 44%),
            rgba(10,42,63,.88);
          text-align: center;
        }
        .fr-extended-navy__action-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 9px;
          color: #d7dfd8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .fr-extended-navy__action-label span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #e3ad42;
        }
        .fr-extended-navy__qr-frame {
          display: grid;
          width: clamp(118px, 9.4vw, 156px);
          aspect-ratio: 1;
          place-items: center;
          padding: 9px;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 8px 25px rgba(0,0,0,.28);
        }
        .fr-extended-navy__qr-frame img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
        .fr-extended-navy__qr-caption {
          margin: 8px 0 0;
          color: #a9c0c2;
          font-size: 10px;
          line-height: 1.25;
        }
        .fr-extended-navy__qr-caption strong {
          display: block;
          color: #f3f0e8;
          font-size: 12px;
        }
        .fr-extended-navy__url {
          margin-top: 5px;
          color: #8bd2d0;
          font-size: 10px;
          font-weight: 750;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }
        .fr-extended-navy__mobile-cta,
        .fr-extended-navy__mobile-caption {
          display: none;
        }
        .fr-extended-navy__eligibility {
          margin: 7px 0 0;
          color: #9cb5b8;
          font-size: 9px;
          line-height: 1.25;
        }
        @media (max-width: 900px) {
          .fr-extended-navy__hero {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, .9fr) minmax(0, 1.15fr) minmax(86px, .4fr);
            height: 100svh;
            min-height: 100svh;
            align-content: stretch;
            gap: 10px;
            padding: 0 12px;
            overflow: hidden;
          }
          .fr-extended-navy__photo {
            height: auto;
            min-height: 0;
          }
          .fr-extended-navy__copy {
            justify-content: space-evenly;
            padding: 18px;
          }
          .fr-extended-navy__brand {
            gap: 10px;
            margin-bottom: 8px;
          }
          .fr-extended-navy__brand img {
            width: 68px;
            max-height: 25px;
          }
          .fr-extended-navy__brand p {
            font-size: 8px;
          }
          .fr-extended-navy__brand p span {
            font-size: 7px;
          }
          .fr-extended-navy__eyebrow {
            margin-bottom: 4px;
            font-size: 8px;
          }
          .fr-extended-navy__copy h1 {
            font-size: clamp(29px, 8vw, 37px);
          }
          .fr-extended-navy__offer {
            gap: 11px;
            margin-top: 8px;
          }
          .fr-extended-navy__offer > strong {
            font-size: 37px;
          }
          .fr-extended-navy__offer p {
            font-size: 10px;
          }
          .fr-extended-navy__terms {
            margin-top: 8px;
            font-size: 9px;
          }
          .fr-extended-navy__action {
            min-height: 86px;
            flex-direction: row;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            text-align: left;
          }
          .fr-extended-navy__action-label,
          .fr-extended-navy__qr-frame,
          .fr-extended-navy__qr-caption,
          .fr-extended-navy__url {
            display: none;
          }
          .fr-extended-navy__mobile-cta {
            display: inline-flex;
            min-height: 48px;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex: 0 0 auto;
            padding: 0 17px;
            border: 1px solid rgba(143,215,212,.26);
            border-radius: 999px;
            background: #123c55;
            box-shadow: 0 8px 18px rgba(0,0,0,.22);
            color: #f7f3e9;
            font-size: 13px;
            font-weight: 800;
            text-decoration: none;
            transition: transform .18s ease, background-color .18s ease;
          }
          .fr-extended-navy__mobile-cta:hover {
            transform: translateY(-1px);
            background: #1b5168;
          }
          .fr-extended-navy__mobile-cta:focus-visible {
            outline: 3px solid #e3ad42;
            outline-offset: 3px;
          }
          .fr-extended-navy__mobile-caption {
            display: block;
            max-width: 42%;
            margin: 0;
            color: #a9c0c2;
            font-size: 10px;
            line-height: 1.3;
          }
          .fr-extended-navy__eligibility {
            display: none;
          }
        }
        @media (min-width: 761px) and (max-width: 900px) {
          .fr-extended-navy__photo {
            width: min(100%, 560px);
            justify-self: center;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fr-extended-navy__mobile-cta { transition: none; }
        }
      `}</style>
    </main>
  );
}