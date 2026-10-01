import { useState } from "react";
import "./_group.css";

type Artwork = "light" | "navy";

const imageBase = "/__mockup/images/fr-chef-event/cover-";

export function Extended() {
  const [artwork, setArtwork] = useState<Artwork>("light");
  const isNavy = artwork === "navy";

  return (
    <main className={`fr-extended fr-extended--${artwork}`}>
      <section className="fr-extended__hero" aria-label="La Pétanque des Toqués">
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet={`${imageBase}${artwork}-mobile-extended.png`}
          />
          <img
            src={`${imageBase}${artwork}-desktop-extended.png`}
            alt={
              isNavy
                ? "Couverture bleu marine de l’offre La Pétanque des Toqués"
                : "Couverture claire de l’offre La Pétanque des Toqués"
            }
          />
        </picture>
      </section>

      <div className="fr-extended__controls" role="group" aria-label="Choisir le visuel">
        <button
          type="button"
          aria-pressed={!isNavy}
          onClick={() => setArtwork("light")}
        >
          Clair
        </button>
        <button
          type="button"
          aria-pressed={isNavy}
          onClick={() => setArtwork("navy")}
        >
          Bleu marine
        </button>
      </div>

      <style>{`
        .fr-extended {
          width: 100%;
          font-family: "Avenir Next", Avenir, "Trebuchet MS", sans-serif;
        }
        .fr-extended__hero {
          width: 100%;
          height: 360px;
          overflow: hidden;
          background: #e9f0eb;
        }
        .fr-extended--navy .fr-extended__hero { background: #07243a; }
        .fr-extended__hero picture,
        .fr-extended__hero img {
          display: block;
          width: 100%;
          height: 100%;
        }
        .fr-extended__hero img {
          object-fit: cover;
          object-position: center;
        }
        .fr-extended__controls {
          display: flex;
          min-height: 32px;
          align-items: center;
          gap: 7px;
          padding: 4px 8px;
          background: #fff;
          color: #263b45;
          font-size: 11px;
        }
        .fr-extended__controls button {
          min-height: 24px;
          padding: 3px 9px;
          border: 1px solid #a8b4b4;
          border-radius: 999px;
          background: white;
          color: #263b45;
          cursor: pointer;
        }
        .fr-extended__controls button[aria-pressed="true"] {
          border-color: #173847;
          background: #173847;
          color: white;
        }
        .fr-extended__controls button:focus-visible {
          outline: 2px solid #d7a229;
          outline-offset: 2px;
        }
        @media (min-width: 768px) {
          .fr-extended__hero { height: 410px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fr-extended *, .fr-extended *::before, .fr-extended *::after {
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </main>
  );
}