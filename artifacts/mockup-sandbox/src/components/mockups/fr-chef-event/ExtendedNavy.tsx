import "./_group.css";

export function ExtendedNavy() {
  return (
    <main className="fr-extended-navy">
      <section
        className="fr-extended-navy__hero"
        aria-label="La Pétanque des Toqués — couverture bleu marine"
      >
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet="/__mockup/images/fr-chef-event/cover-navy-mobile-extended.png"
          />
          <img
            src="/__mockup/images/fr-chef-event/cover-navy-desktop-extended.png"
            alt="Couverture bleu marine de l’offre La Pétanque des Toqués"
          />
        </picture>
      </section>

      <style>{`
        .fr-extended-navy {
          width: 100%;
        }
        .fr-extended-navy__hero {
          width: 100%;
          height: 360px;
          overflow: hidden;
          background: #07243a;
        }
        .fr-extended-navy__hero picture,
        .fr-extended-navy__hero img {
          display: block;
          width: 100%;
          height: 100%;
        }
        .fr-extended-navy__hero img {
          object-fit: cover;
          object-position: center;
        }
        @media (min-width: 768px) {
          .fr-extended-navy__hero { height: 410px; }
        }
      `}</style>
    </main>
  );
}