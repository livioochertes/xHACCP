import coverNavyDesktop from "@/assets/fr-chef-event/cover-navy-desktop-hero-1710x410.png?inline";
import "./_group.css";

export function ExtendedNavy() {
  return (
    <main className="fr-extended-navy">
      <section
        className="fr-extended-navy__hero"
        aria-label="La Pétanque des Toqués — couverture bleu marine"
      >
        <img
          src={coverNavyDesktop}
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
          height: 410px;
          overflow: hidden;
          background: #07243a;
        }
        .fr-extended-navy__hero img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
      `}</style>
    </main>
  );
}