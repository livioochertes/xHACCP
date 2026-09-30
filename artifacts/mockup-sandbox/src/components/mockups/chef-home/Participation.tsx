const teamPhoto = "/__mockup/images/chef-home/team.jpeg";
const eventMark = "/__mockup/images/chef-home/event-mark.png";
const xhaccpLogo = "/__mockup/images/xhaccp-logo.png";

export function Participation() {
  return (
    <main className="participation-export" data-export-root aria-label="Visuel xHACCP France — La Pétanque des Toqués">
      <section className="participation-artboard">
        <div className="part-sun part-sun-large" aria-hidden="true" />
        <div className="part-sun part-sun-small" aria-hidden="true" />
        <div className="part-grain" aria-hidden="true" />

        <figure className="part-photo">
          <img src={teamPhoto} alt="L’équipe xHACCP France réunie à La Pétanque des Toqués" />
          <figcaption>Une belle journée entre passionnés</figcaption>
        </figure>

        <div className="part-copy">
          <p className="part-edition">10<sup>e</sup> édition <span /> 2026</p>
          <h1>La Pétanque<br /><em>des Toqués</em></h1>
          <p className="part-subtitle">xHACCP France retrouve les chefs.</p>

          <div className="part-offer" aria-label="20 % de remise pendant un an">
            <strong>−20&nbsp;%</strong>
            <span>sur les produits xHACCP France<br /><b>pendant 1 an</b></span>
          </div>
          <p className="part-deadline">Première commande validée sous 30 jours</p>
          <a className="part-cta" href="https://xhaccp.fr/chef-event">
            Découvrir mon avantage <span aria-hidden="true">→</span>
          </a>
          <p className="part-eligibility">
            Participants · personnes qui aiment la page Facebook<br />
            · personnes qui connaissent un participant
          </p>
        </div>

        <aside className="part-event" aria-label="La Pétanque des Toqués, Antibes, 2026">
          <img src={eventMark} alt="La Pétanque des Toqués — 10e édition" />
          <div className="part-event-rule" />
          <p>Le Fort Carré · Antibes</p>
          <p>Génération Maximin</p>
          <div className="part-boules" aria-hidden="true"><i /><i /></div>
        </aside>
        <div className="part-bottom-note">
          <img src={xhaccpLogo} alt="xHACCP France" />
          <span aria-hidden="true">×</span>
          <b>les chefs</b>
        </div>
      </section>

      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; margin: 0; }
        body { overflow: hidden; font-family: Arial, system-ui, sans-serif; }
        .participation-export {
          position: fixed; inset: 0; display: grid; place-items: center;
          overflow: hidden; background: #f3eedf; color: #102f4d;
          font-family: Arial, system-ui, sans-serif;
        }
        .participation-artboard {
          position: relative; width: min(100vw, calc(100dvh * 3.121951)); aspect-ratio: 1920 / 615;
          overflow: hidden; isolation: isolate; container-type: inline-size;
          background:
            radial-gradient(ellipse at 58% 48%, rgba(255,255,255,.88) 0 19%, transparent 48%),
            linear-gradient(112deg, #f5efdf 0%, #f7f3e9 51%, #e9f1eb 100%);
        }
        .participation-artboard::before {
          content: ""; position: absolute; z-index: -1; inset: 0;
          background:
            linear-gradient(90deg, rgba(12,47,75,.05) 1px, transparent 1px),
            linear-gradient(rgba(12,47,75,.035) 1px, transparent 1px);
          background-size: 5.2cqw 5.2cqw; opacity: .24;
          mask-image: linear-gradient(90deg, #000 0%, transparent 34%, transparent 70%, #000 100%);
        }
        .part-grain {
          position: absolute; inset: 0; pointer-events: none; opacity: .15; z-index: 8;
          background-image: radial-gradient(rgba(12,47,75,.27) .45px, transparent .7px);
          background-size: 4px 4px; mix-blend-mode: multiply;
        }
        .part-sun { position: absolute; border-radius: 50%; pointer-events: none; }
        .part-sun-large {
          width: 35cqw; aspect-ratio: 1; left: 6.5%; top: -30%;
          background: linear-gradient(135deg, #f3c856, #f5d981 75%);
          opacity: .73;
        }
        .part-sun-small {
          width: 8.2cqw; aspect-ratio: 1; left: 20%; bottom: -21%;
          border: 2px solid rgba(11,47,76,.16);
        }
        .part-photo {
          position: absolute; z-index: 2; left: 2.2%; top: 5.3%; width: 25.3%; height: 89%;
          margin: 0; overflow: hidden; border: .48cqw solid #fffaf0;
          border-radius: 48% 48% 7% 7% / 35% 35% 7% 7%;
          background: #d6e9ec; box-shadow: 0 1.1cqw 2.6cqw rgba(19,45,58,.18);
          transform: rotate(-1.2deg);
        }
        .part-photo::after {
          content: ""; position: absolute; inset: 55% 0 0;
          background: linear-gradient(transparent, rgba(8,37,59,.68));
        }
        .part-photo img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 46%; }
        .part-photo figcaption {
          position: absolute; z-index: 1; left: 9%; bottom: 4%; color: #fffaf0;
          font-size: 1.02cqw; font-weight: 700; letter-spacing: .04em;
        }
        .part-copy {
          position: absolute; z-index: 4; left: 30.1%; top: 22.8%; width: 39.8%;
          text-align: center; color: #102f4d;
        }
        .part-edition {
          margin: 0; font-size: .93cqw; font-weight: 700; letter-spacing: .2em;
          text-transform: uppercase; color: #316177;
        }
        .part-edition sup { font-size: .64em; letter-spacing: 0; vertical-align: super; }
        .part-edition span {
          display: inline-block; width: .34cqw; height: .34cqw; margin: 0 .48cqw .08cqw;
          border-radius: 50%; background: #e5b841;
        }
        .part-copy h1 {
          margin: .34cqw 0 .34cqw; font-size: 3.2cqw; line-height: .9;
          letter-spacing: -.055em; font-weight: 800;
        }
        .part-copy h1 em { font-style: normal; color: #176083; }
        .part-subtitle { margin: .34cqw 0 0; font-size: 1.28cqw; font-weight: 600; letter-spacing: -.015em; }
        .part-offer {
          display: flex; justify-content: center; align-items: center; gap: .76cqw;
          margin-top: .5cqw; min-height: 2.3cqw;
        }
        .part-offer strong { font-size: 2.18cqw; line-height: 1; color: #c78213; letter-spacing: -.055em; }
        .part-offer span { text-align: left; font-size: 1.02cqw; line-height: 1.22; font-weight: 500; }
        .part-offer b { color: #176083; }
        .part-deadline { margin: .18cqw 0 0; font-size: .97cqw; font-weight: 600; color: #31546a; }
        .part-cta {
          display: inline-flex; justify-content: center; align-items: center; gap: .7cqw;
          min-height: 2.05cqw; margin-top: .5cqw; padding: 0 1.5cqw;
          border-radius: 99px; background: #0d3657; color: #fff8e7; text-decoration: none;
          font-size: 1.04cqw; font-weight: 700; letter-spacing: .01em;
          box-shadow: 0 .4cqw .9cqw rgba(13,54,87,.18);
        }
        .part-cta span { color: #f2c653; font-size: 1.3em; line-height: 1; }
        .part-eligibility { margin: .28cqw 0 0; font-size: .82cqw; line-height: 1.28; color: #4a6474; }
        .part-event {
          position: absolute; z-index: 3; left: 77.7%; top: 19.5%; width: 19.2%;
          text-align: center; color: #173954;
        }
        .part-event img { display: block; width: 100%; height: auto; }
        .part-event-rule {
          width: 2.1cqw; height: 2px; margin: 1.05cqw auto .7cqw;
          background: #dcae32;
        }
        .part-event p { margin: .28cqw 0; font-size: 1.08cqw; line-height: 1.26; font-weight: 700; }
        .part-event p:last-of-type { color: #527487; font-size: .94cqw; font-weight: 600; }
        .part-boules { display: flex; justify-content: center; gap: .6cqw; margin-top: 1.1cqw; }
        .part-boules i { display: block; width: 1.15cqw; aspect-ratio: 1; border-radius: 50%; background: #d8a82f; box-shadow: inset -.18cqw -.17cqw 0 rgba(122,81,10,.17); }
        .part-boules i:last-child { background: #3b8eaa; transform: translateY(-.38cqw); }
        .part-bottom-note {
          position: absolute; right: 3.1%; bottom: 17.8%; display: flex; align-items: center;
          gap: .28cqw; color: #23485f; font-size: .86cqw; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase;
        }
        .part-bottom-note span { padding: 0 .25cqw; color: #d8a82f; }
        .part-bottom-note img {
          display: block; width: 8.2cqw; height: 4.1cqw; object-fit: contain;
          mix-blend-mode: multiply;
        }
        @media (max-aspect-ratio: 1920/615) {
          .participation-artboard { width: min(100vw, calc(100dvh * 3.121951)); }
        }
      `}</style>
    </main>
  );
}