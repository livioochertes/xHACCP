import "./_group.css";

export function Extended() {
  return (
    <main className="fr-extended">
      <section className="fr-extended__hero" aria-label="La Pétanque des Toqués — couverture claire">
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet="/__mockup/images/fr-chef-event/cover-light-mobile-extended.png"
          />
          <img
            src="/__mockup/images/fr-chef-event/cover-light-desktop-extended.png"
            alt="Couverture claire de l’offre La Pétanque des Toqués"
          />
        </picture>
      </section>

      <style>{`
        .fr-extended {
          width: 100%;
        }
        .fr-extended__hero {
          width: 100%;
          height: 360px;
          overflow: hidden;
          background: #e9f0eb;
        }
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
        @media (min-width: 768px) {
          .fr-extended__hero { height: 410px; }
        }
      `}</style>
    </main>
  );
}