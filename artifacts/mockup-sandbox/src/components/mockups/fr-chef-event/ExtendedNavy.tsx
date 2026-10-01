import coverNavyDesktop from "@/assets/fr-chef-event/cover-navy-desktop-extended.png?inline";
import coverNavyMobile from "@/assets/fr-chef-event/cover-navy-mobile-extended.png?inline";
import "./_group.css";

export function ExtendedNavy() {
  return (
    <main className="fr-extended-navy">
      <section
        className="fr-extended-navy__hero"
        aria-label="La Pétanque des Toqués — couverture bleu marine"
      >
        <img
          className="fr-extended-navy__cover--desktop"
          src={coverNavyDesktop}
          alt="Couverture bleu marine de l’offre La Pétanque des Toqués"
        />
        <img
          className="fr-extended-navy__cover--mobile"
          src={coverNavyMobile}
          alt="Couverture bleu marine de l’offre La Pétanque des Toqués"
        />
      </section>

      <style>{`
        .fr-extended-navy {
          width: 100%;
        }
        .fr-extended-navy__hero {
          position: relative;
          width: 100%;
          height: 360px;
          overflow: hidden;
          background: #07243a;
        }
        .fr-extended-navy__hero img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }
        .fr-extended-navy__hero img {
          object-fit: cover;
          object-position: center;
        }
        .fr-extended-navy__cover--mobile {
          display: none;
        }
        @media (max-width: 767px) {
          .fr-extended-navy__cover--desktop { display: none; }
          .fr-extended-navy__cover--mobile { display: block; }
        }
        @media (min-width: 768px) {
          .fr-extended-navy__hero { height: 410px; }
        }
      `}</style>
    </main>
  );
}