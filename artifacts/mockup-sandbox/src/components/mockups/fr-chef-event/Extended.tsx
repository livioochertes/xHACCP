import coverLightDesktop from "@/assets/fr-chef-event/cover-light-desktop-hero-1710x410.png?inline";
import "./_group.css";

export function Extended() {
  return (
    <main className="fr-extended">
      <section className="fr-extended__hero" aria-label="La Pétanque des Toqués — couverture claire">
        <img
          src={coverLightDesktop}
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
          height: 410px;
          overflow: hidden;
          background: #e9f0eb;
        }
        .fr-extended__hero img {
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