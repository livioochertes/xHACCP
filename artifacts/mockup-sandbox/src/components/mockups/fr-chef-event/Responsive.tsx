import { useState } from "react";
import "./_group.css";

type Artwork = "light" | "navy";

const photo = "/__mockup/images/fr-chef-event/photo.png";

export function Responsive() {
  const [artwork, setArtwork] = useState<Artwork>("light");
  const isNavy = artwork === "navy";

  return (
    <main className={`fr-event fr-event--${artwork}`}>
      <section className="fr-event__hero" aria-label="La Pétanque des Toqués">
        <div className="fr-event__photo">
          <img src={photo} alt="Des chefs réunis à La Pétanque des Toqués à Antibes" />
        </div>

        <div className="fr-event__content">
          <header className="fr-event__header">
            <img
              className="fr-event__logo"
              src={`/__mockup/images/fr-chef-event/logo-${artwork}.png`}
              alt="xHACCP"
            />
            <div className="fr-event__event-meta">
              <p className="fr-event__eyebrow">
                {isNavy ? "FRANCE · ANTIBES 2026" : "UNE RENCONTRE ENTRE CHEFS"}
              </p>
              {!isNavy && <p className="fr-event__date">ANTIBES · 10E ÉDITION · 2026</p>}
            </div>
            <div className="fr-event__switch" aria-label="Choisir le visuel">
              <button
                type="button"
                aria-label="Visuel clair"
                aria-pressed={!isNavy}
                className="fr-event__swatch fr-event__swatch--light"
                onClick={() => setArtwork("light")}
              />
              <button
                type="button"
                aria-label="Visuel bleu marine"
                aria-pressed={isNavy}
                className="fr-event__swatch fr-event__swatch--navy"
                onClick={() => setArtwork("navy")}
              />
            </div>
          </header>

          <div className="fr-event__body">
            <div className="fr-event__story">
              <p className="fr-event__kicker">
                {isNavy
                  ? "LA PÉTANQUE DES TOQUÉS · 10E ÉDITION"
                  : "LA PÉTANQUE DES TOQUÉS"}
              </p>
              <h1 className="fr-event__headline">
                {isNavy ? (
                  <>Un avantage<br className="fr-event__desktop-break" /> qui dure.</>
                ) : (
                  <>Le goût de se<br className="fr-event__desktop-break" /> retrouver.</>
                )}
              </h1>
              {!isNavy && (
                <p className="fr-event__intro">
                  xHACCP France célèbre les chefs de la Riviera.
                </p>
              )}

              <div className="fr-event__offer">
                <span className="fr-event__discount">
                  {isNavy ? "−20%" : "−20%"}
                </span>
                <div className="fr-event__offer-copy">
                  {isNavy ? (
                    <>
                      <strong className="fr-event__duration">PENDANT 1 AN</strong>
                      <span>sur les produits xHACCP France</span>
                    </>
                  ) : (
                    <strong>sur les produits xHACCP France pendant 1 an</strong>
                  )}
                </div>
              </div>

              <p className="fr-event__fineprint">
                <strong>Première commande validée sous 30 jours.</strong>
                <span>Votre code personnel vous sera envoyé par e-mail.</span>
              </p>
            </div>

            <aside className="fr-event__qr">
              <p className="fr-event__qr-label">
                {isNavy ? "OFFRE SPÉCIALE CHEFS" : "L’OFFRE DES TOQUÉS"}
              </p>
              <a
                className="fr-event__qr-link"
                href="https://xhaccp.fr/chef-event"
                target="_blank"
                rel="noreferrer"
                aria-label="xhaccp.fr/chef-event"
              >
                <img
                  src={`/__mockup/images/fr-chef-event/qr-panel-${artwork}.png`}
                  alt="Code QR pour xhaccp.fr/chef-event"
                />
                <span className="fr-event__qr-action">
                  {isNavy ? "SCANNER POUR VOUS INSCRIRE" : "Scannez pour découvrir l’offre"}
                </span>
                <span className="fr-event__url">xhaccp.fr/chef-event</span>
              </a>
              <p className="fr-event__qr-note">
                {isNavy
                  ? "Code de réduction envoyé par e-mail"
                  : "Participants, proches et communauté de l’événement."}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <style>{`
        .fr-event {
          --event-ink: #173847;
          --event-muted: #6b7d7f;
          --event-paper: #f2f1e8;
          --event-accent: #d7a229;
          width: 100%;
          height: 360px;
          overflow: hidden;
          font-family: "Avenir Next", Avenir, "Trebuchet MS", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .fr-event--navy {
          --event-ink: #f5f2e9;
          --event-muted: #c0d0d0;
          --event-paper: #0c3548;
          --event-accent: #e3b83e;
        }
        .fr-event__hero {
          position: relative;
          display: grid;
          grid-template-columns: 27% minmax(0, 1fr);
          width: 100%;
          height: 100%;
          background: var(--event-paper);
          color: var(--event-ink);
          transition: background-color 240ms ease, color 240ms ease;
        }
        .fr-event__photo {
          position: relative;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          background: #d6e1dd;
        }
        .fr-event__photo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 50% 46%;
        }
        .fr-event__content {
          display: flex;
          min-width: 0;
          flex-direction: column;
          justify-content: center;
          padding: 20px 3.3% 18px 3.6%;
        }
        .fr-event__header {
          display: flex;
          align-items: center;
          min-height: 45px;
          gap: 17px;
          margin-bottom: 13px;
        }
        .fr-event__logo {
          display: block;
          width: 95px;
          height: 45px;
          flex: 0 0 auto;
          object-fit: contain;
        }
        .fr-event__event-meta { min-width: 0; }
        .fr-event__eyebrow,
        .fr-event__date,
        .fr-event__kicker,
        .fr-event__qr-label {
          margin: 0;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .17em;
          line-height: 1.45;
        }
        .fr-event__eyebrow { color: var(--event-ink); }
        .fr-event__date {
          margin-top: 3px;
          color: var(--event-muted);
          font-size: 8px;
          letter-spacing: .12em;
        }
        .fr-event__switch {
          display: flex;
          gap: 7px;
          margin-left: auto;
          padding-left: 10px;
        }
        .fr-event__swatch {
          width: 13px;
          height: 13px;
          padding: 0;
          border: 1px solid rgba(21, 51, 65, .3);
          border-radius: 50%;
          cursor: pointer;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }
        .fr-event__swatch:hover { transform: scale(1.15); }
        .fr-event__swatch:focus-visible {
          outline: 2px solid var(--event-accent);
          outline-offset: 3px;
        }
        .fr-event__swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--event-paper), 0 0 0 3px var(--event-muted); }
        .fr-event__swatch--light { background: #f2f1e8; }
        .fr-event__swatch--navy { background: #0c3548; }
        .fr-event__body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 182px;
          align-items: center;
          gap: clamp(16px, 2vw, 30px);
          min-height: 0;
        }
        .fr-event__story { min-width: 0; }
        .fr-event__kicker {
          margin-bottom: 7px;
          color: #287b7c;
          font-size: 9px;
          letter-spacing: .2em;
        }
        .fr-event--navy .fr-event__kicker { color: #74c6c6; }
        .fr-event__headline {
          margin: 0;
          color: var(--event-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(38px, 3.65vw, 51px);
          font-weight: 700;
          letter-spacing: -.055em;
          line-height: .88;
        }
        .fr-event__intro {
          margin: 10px 0 0;
          color: var(--event-ink);
          font-size: 11px;
          font-weight: 650;
          line-height: 1.35;
        }
        .fr-event__offer {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
        }
        .fr-event__discount {
          flex: 0 0 auto;
          color: var(--event-accent);
          font-size: 38px;
          font-weight: 850;
          letter-spacing: -.09em;
          line-height: .95;
        }
        .fr-event__offer-copy {
          display: flex;
          flex-direction: column;
          color: var(--event-ink);
          font-size: 10px;
          font-weight: 650;
          line-height: 1.25;
        }
        .fr-event__duration {
          font-size: 10px;
          letter-spacing: .13em;
        }
        .fr-event__fineprint {
          display: flex;
          flex-direction: column;
          margin: 8px 0 0;
          color: var(--event-muted);
          font-size: 9px;
          line-height: 1.4;
        }
        .fr-event__fineprint strong { color: var(--event-ink); }
        .fr-event__qr {
          display: flex;
          width: 100%;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .fr-event__qr-label {
          margin-bottom: 7px;
          color: #287b7c;
          font-size: 8px;
          letter-spacing: .15em;
        }
        .fr-event--navy .fr-event__qr-label { color: #85d0d0; }
        .fr-event__qr-link {
          display: flex;
          width: 100%;
          flex-direction: column;
          align-items: center;
          padding: 7px 10px 8px;
          border-radius: 12px;
          background: #fffefa;
          color: #173847;
          text-decoration: none;
          box-shadow: 0 8px 22px rgba(18, 44, 54, .1);
          transition: transform 180ms ease;
        }
        .fr-event__qr-link:hover { transform: translateY(-2px); }
        .fr-event__qr-link:focus-visible {
          outline: 3px solid var(--event-accent);
          outline-offset: 3px;
        }
        .fr-event__qr-link img {
          display: block;
          width: 100%;
          height: auto;
        }
        .fr-event__qr-action {
          margin-top: 2px;
          font-size: 9px;
          font-weight: 750;
          line-height: 1.2;
        }
        .fr-event__url {
          margin-top: 3px;
          color: #287b7c;
          font-size: 8px;
          font-weight: 800;
          line-height: 1.15;
        }
        .fr-event__qr-note {
          max-width: 175px;
          margin: 7px 0 0;
          color: var(--event-muted);
          font-size: 8px;
          line-height: 1.3;
        }
        @media (min-width: 768px) {
          .fr-event { height: 410px; }
        }
        @media (max-width: 767px) {
          .fr-event__hero { display: flex; flex-direction: column; }
          .fr-event__photo {
            height: 88px;
            flex: 0 0 88px;
          }
          .fr-event__photo img { object-position: 50% 40%; }
          .fr-event__content {
            flex: 1 1 auto;
            justify-content: flex-start;
            padding: 7px 13px 8px;
          }
          .fr-event__header {
            min-height: 30px;
            gap: 9px;
            margin-bottom: 3px;
          }
          .fr-event__logo { width: 67px; height: 31px; }
          .fr-event__eyebrow { font-size: 8px; letter-spacing: .1em; }
          .fr-event__date { margin-top: 1px; font-size: 7px; letter-spacing: .07em; }
          .fr-event__switch { gap: 6px; padding-left: 5px; }
          .fr-event__swatch { width: 12px; height: 12px; }
          .fr-event__body {
            flex: 1;
            grid-template-columns: minmax(0, 1fr) 118px;
            align-items: center;
            gap: 9px;
          }
          .fr-event__kicker {
            margin-bottom: 4px;
            font-size: 7.5px;
            letter-spacing: .12em;
            white-space: nowrap;
          }
          .fr-event__headline {
            font-size: clamp(25px, 7vw, 29px);
            letter-spacing: -.055em;
            line-height: .94;
          }
          .fr-event__desktop-break { display: none; }
          .fr-event__intro {
            margin-top: 3px;
            font-size: 9px;
            line-height: 1.2;
          }
          .fr-event__offer { gap: 6px; margin-top: 5px; }
          .fr-event__discount { font-size: 33px; }
          .fr-event__offer-copy { font-size: 8.5px; line-height: 1.22; }
          .fr-event__duration { font-size: 8.8px; }
          .fr-event__fineprint { margin-top: 4px; font-size: 8px; line-height: 1.25; }
          .fr-event__qr-label {
            margin-bottom: 4px;
            font-size: 7px;
            letter-spacing: .1em;
            white-space: nowrap;
          }
          .fr-event__qr-link { padding: 4px 5px 5px; border-radius: 8px; }
          .fr-event__qr-action { margin-top: 1px; font-size: 7.5px; }
          .fr-event__url { margin-top: 2px; font-size: 7px; }
          .fr-event__qr-note { margin-top: 4px; font-size: 7px; line-height: 1.2; }
        }
        @media (max-width: 350px) {
          .fr-event__body { grid-template-columns: minmax(0, 1fr) 104px; gap: 6px; }
          .fr-event__content { padding-right: 9px; padding-left: 9px; }
          .fr-event__headline { font-size: 24px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fr-event *, .fr-event *::before, .fr-event *::after {
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </main>
  );
}