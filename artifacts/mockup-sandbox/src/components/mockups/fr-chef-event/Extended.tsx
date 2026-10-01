import coverLightDesktop from "@/assets/fr-chef-event/cover-light-desktop-extended.png?inline";
import coverLightMobile from "@/assets/fr-chef-event/cover-light-mobile-extended.png?inline";
import "./_group.css";

export function Extended() {
  return (
    <main className="fr-extended">
      <section className="fr-extended__hero" aria-label="La Pétanque des Toqués — couverture claire">
        <img
          className="fr-extended__cover--desktop"
          src={coverLightDesktop}
          alt="Couverture claire de l’offre La Pétanque des Toqués"
        />
        <img
          className="fr-extended__cover--mobile"
          src={coverLightMobile}
          alt="Couverture claire de l’offre La Pétanque des Toqués"
        />
      </section>

      <style>{`
        .fr-extended {
          width: 100%;
        }
        .fr-extended__hero {
          position: relative;
          width: 100%;
          height: 360px;
          overflow: hidden;
          background: #e9f0eb;
        }
        .fr-extended__hero img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }
        .fr-extended__hero img {
          object-fit: cover;
          object-position: center;
        }
        .fr-extended__cover--mobile {
          display: none;
        }
        @media (max-width: 767px) {
          .fr-extended__cover--desktop { display: none; }
          .fr-extended__cover--mobile { display: block; }
        }
        @media (min-width: 768px) {
          .fr-extended__hero { height: 410px; }
        }
      `}</style>
    </main>
  );
}