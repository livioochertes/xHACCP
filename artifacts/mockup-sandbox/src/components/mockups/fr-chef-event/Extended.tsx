import "./_group.css";

export function Extended() {
  return (
    <main className="fr-extended" aria-label="xHACCP France — La Pétanque des Toqués">
      <section className="fr-extended__hero" aria-label="Offre La Pétanque des Toqués">
        <figure className="fr-extended__photo">
          <img
            src="/__mockup/images/chef-home/team.jpeg"
            alt="Les trois participants à La Pétanque des Toqués, à Antibes"
          />
          <figcaption>Antibes · 10e édition · 2026</figcaption>
        </figure>

        <section className="fr-extended__copy" aria-labelledby="fr-extended-title">
          <div className="fr-extended__brand">
            <img src="/__mockup/images/xhaccp-logo.png" alt="xHACCP France" />
            <p>
              Une rencontre entre chefs
              <span>Antibes · 10e édition · 2026</span>
            </p>
          </div>

          <p className="fr-extended__eyebrow">La Pétanque des Toqués</p>
          <h1 id="fr-extended-title">
            Le goût de se <em>retrouver.</em>
          </h1>
          <p className="fr-extended__subtitle">
            xHACCP France célèbre les chefs de la Riviera.
          </p>

          <div className="fr-extended__offer">
            <strong>−20<span>%</span></strong>
            <p>
              sur les produits xHACCP France
              <b>pendant 1 an</b>
            </p>
          </div>

          <p className="fr-extended__terms">
            <span aria-hidden="true" />
            <span>
              Première commande validée sous 30 jours.
              <small>Votre code personnel sera envoyé par e-mail.</small>
            </span>
          </p>
        </section>

        <aside className="fr-extended__action" aria-label="Découvrir l’offre">
          <p className="fr-extended__action-label">
            <span aria-hidden="true" />
            L’offre des Toqués
          </p>
          <div className="fr-extended__qr-frame">
            <img
              src="/__mockup/images/chef-home/original-qr.png"
              alt="QR code pour accéder à l’offre xHACCP France"
            />
          </div>
          <p className="fr-extended__qr-caption">
            Scannez pour
            <strong>découvrir l’offre</strong>
          </p>
          <a
            className="fr-extended__url"
            href="https://xhaccp.fr/chef-event"
          >
            xhaccp.fr/chef-event
          </a>
          <a
            className="fr-extended__mobile-cta"
            href="https://xhaccp.fr/chef-event"
            aria-label="Découvrir l’offre La Pétanque des Toqués"
          >
            Découvrir l’offre <span aria-hidden="true">→</span>
          </a>
          <p className="fr-extended__eligibility">
            Participants, proches et communauté de l’événement
          </p>
        </aside>
      </section>

      <style>{`
        .fr-extended {
          width: 100%;
          color: #173746;
          background: #e9f0eb;
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .fr-extended,
        .fr-extended * { box-sizing: border-box; }
        .fr-extended__hero {
          display: grid;
          grid-template-columns: minmax(0, .92fr) minmax(0, 1.6fr) minmax(0, .82fr);
          gap: 12px;
          width: 100%;
          height: 410px;
          padding: 12px;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 79% 4%, rgba(255,255,255,.78), transparent 38%),
            linear-gradient(115deg, #e7eee8 0%, #f3f0e6 55%, #e4eee8 100%);
        }
        .fr-extended__photo,
        .fr-extended__copy,
        .fr-extended__action {
          min-width: 0;
          min-height: 0;
          margin: 0;
          overflow: hidden;
          border: 1px solid rgba(23,55,70,.08);
          border-radius: 18px;
          box-shadow: 0 12px 32px rgba(28,54,57,.08);
        }
        .fr-extended__photo {
          position: relative;
          isolation: isolate;
          background: #d9e5dd;
        }
        .fr-extended__photo::after {
          position: absolute;
          inset: 42% 0 0;
          z-index: 0;
          background: linear-gradient(transparent, rgba(9,33,43,.62));
          content: "";
        }
        .fr-extended__photo img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 46%;
        }
        .fr-extended__photo figcaption {
          position: absolute;
          z-index: 1;
          right: 16px;
          bottom: 15px;
          left: 16px;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          text-shadow: 0 1px 8px rgba(0,0,0,.35);
        }
        .fr-extended__copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(18px, 2vw, 32px);
          background: rgba(250,249,243,.94);
        }
        .fr-extended__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 15px;
        }
        .fr-extended__brand img {
          display: block;
          width: 76px;
          max-height: 32px;
          object-fit: contain;
        }
        .fr-extended__brand p {
          margin: 0;
          color: #38535e;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .11em;
          line-height: 1.35;
          text-transform: uppercase;
        }
        .fr-extended__brand p span {
          display: block;
          margin-top: 3px;
          color: #71817c;
          font-size: 8px;
          letter-spacing: .12em;
        }
        .fr-extended__eyebrow {
          margin: 0 0 7px;
          color: #308577;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .fr-extended__copy h1 {
          margin: 0;
          color: #143448;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 2.25vw, 40px);
          font-weight: 700;
          letter-spacing: -.045em;
          line-height: .98;
        }
        .fr-extended__copy h1 em {
          color: #2e8278;
          font-weight: 600;
        }
        .fr-extended__subtitle {
          margin: 8px 0 0;
          color: #4a6268;
          font-size: clamp(11px, .92vw, 14px);
          line-height: 1.35;
        }
        .fr-extended__offer {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 13px;
        }
        .fr-extended__offer > strong {
          color: #c27635;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(34px, 2.7vw, 46px);
          letter-spacing: -.06em;
          line-height: .9;
          white-space: nowrap;
        }
        .fr-extended__offer > strong span {
          margin-left: 1px;
          font-size: .57em;
        }
        .fr-extended__offer p {
          margin: 0;
          color: #304c56;
          font-size: clamp(10px, .84vw, 13px);
          font-weight: 650;
          line-height: 1.25;
        }
        .fr-extended__offer p b {
          display: block;
          color: #b16a30;
          font-size: 1.08em;
        }
        .fr-extended__terms {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 12px 0 0;
          color: #4a6268;
          font-size: 10px;
          line-height: 1.4;
        }
        .fr-extended__terms > span:first-child {
          flex: 0 0 7px;
          width: 7px;
          height: 7px;
          margin-top: 3px;
          border-radius: 50%;
          background: #4f9b8c;
        }
        .fr-extended__terms small {
          display: block;
          color: #73807b;
          font-size: inherit;
        }
        .fr-extended__action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 15px;
          background: rgba(250,249,243,.91);
          text-align: center;
        }
        .fr-extended__action-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 9px;
          color: #496268;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .fr-extended__action-label span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c58a47;
        }
        .fr-extended__qr-frame {
          display: grid;
          width: clamp(118px, 9.4vw, 156px);
          aspect-ratio: 1;
          place-items: center;
          padding: 9px;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 8px 25px rgba(21,49,54,.11);
        }
        .fr-extended__qr-frame img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
        .fr-extended__qr-caption {
          margin: 8px 0 0;
          color: #586d70;
          font-size: 10px;
          line-height: 1.25;
        }
        .fr-extended__qr-caption strong {
          display: block;
          color: #173746;
          font-size: 12px;
        }
        .fr-extended__url {
          margin-top: 5px;
          color: #2e8278;
          font-size: 10px;
          font-weight: 750;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }
        .fr-extended__mobile-cta {
          display: none;
        }
        .fr-extended__eligibility {
          margin: 7px 0 0;
          color: #71817c;
          font-size: 9px;
          line-height: 1.25;
        }
        @media (max-width: 900px) {
          .fr-extended__hero {
            grid-template-columns: minmax(0, 1fr);
            height: auto;
            min-height: 100svh;
            align-content: center;
            gap: 10px;
            padding: 12px;
            overflow: visible;
          }
          .fr-extended__photo {
            height: clamp(168px, 22svh, 205px);
          }
          .fr-extended__copy {
            padding: 18px;
          }
          .fr-extended__brand {
            gap: 10px;
            margin-bottom: 11px;
          }
          .fr-extended__brand img {
            width: 70px;
            max-height: 26px;
          }
          .fr-extended__brand p {
            font-size: 8px;
          }
          .fr-extended__brand p span {
            font-size: 7px;
          }
          .fr-extended__eyebrow {
            margin-bottom: 5px;
            font-size: 9px;
          }
          .fr-extended__copy h1 {
            font-size: clamp(30px, 8.2vw, 38px);
          }
          .fr-extended__subtitle {
            margin-top: 6px;
            font-size: 12px;
          }
          .fr-extended__offer {
            gap: 11px;
            margin-top: 10px;
          }
          .fr-extended__offer > strong {
            font-size: 38px;
          }
          .fr-extended__offer p {
            font-size: 11px;
          }
          .fr-extended__terms {
            margin-top: 10px;
            font-size: 10px;
          }
          .fr-extended__action {
            min-height: 86px;
            flex-direction: row;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            text-align: left;
          }
          .fr-extended__action-label,
          .fr-extended__qr-frame,
          .fr-extended__qr-caption,
          .fr-extended__url {
            display: none;
          }
          .fr-extended__mobile-cta {
            display: inline-flex;
            min-height: 48px;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex: 0 0 auto;
            padding: 0 17px;
            border-radius: 999px;
            background: #173f4d;
            box-shadow: 0 8px 18px rgba(23,63,77,.16);
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            text-decoration: none;
            transition: transform .18s ease, background-color .18s ease;
          }
          .fr-extended__mobile-cta:hover {
            transform: translateY(-1px);
            background: #22586a;
          }
          .fr-extended__mobile-cta:focus-visible {
            outline: 3px solid #c27635;
            outline-offset: 3px;
          }
          .fr-extended__eligibility {
            max-width: 42%;
            margin: 0;
            font-size: 10px;
          }
        }
        @media (min-width: 761px) and (max-width: 900px) {
          .fr-extended__photo {
            width: min(100%, 560px);
            height: clamp(260px, 34vw, 300px);
            justify-self: center;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fr-extended__mobile-cta { transition: none; }
        }
      `}</style>
    </main>
  );
}