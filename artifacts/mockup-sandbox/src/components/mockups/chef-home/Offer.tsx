const photo = "/__mockup/images/chef-home/team.jpeg";
const eventMark = "/__mockup/images/chef-home/event-mark.png";
const qr = "/__mockup/images/chef-home/original-qr.png";
const brand = "/__mockup/images/xhaccp-logo.png";

const css = `
*{box-sizing:border-box}
html,body,#root{margin:0;width:100%;min-height:100%;overflow:hidden}
body{font-family:Arial,system-ui,sans-serif}
.offer{position:relative;width:100vw;aspect-ratio:1920/615;overflow:hidden;color:#f7fbff;background:#062744;isolation:isolate}
.offer:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#061f39 0%,#092b4b 28%,#0a3154 52%,#082848 100%);z-index:-3}
.offer:after{content:"";position:absolute;inset:0;opacity:.12;z-index:-1;pointer-events:none;background-image:radial-gradient(#90d8ee 0.65px,transparent .65px);background-size:9px 9px;mask-image:linear-gradient(90deg,#000,transparent 32%,transparent 70%,#000)}
.team-photo{position:absolute;left:0;top:0;width:26.05%;height:100%;object-fit:cover;object-position:center 45%;filter:saturate(.82) contrast(1.06)}
.photo-shade{position:absolute;left:0;top:0;width:33%;height:100%;background:linear-gradient(90deg,rgba(4,28,51,.08) 32%,rgba(5,32,56,.75) 76%,#082a49 100%),linear-gradient(0deg,rgba(4,24,43,.56),transparent 68%)}
.photo-rule{position:absolute;left:25.7%;top:0;height:100%;width:7px;background:#43c5df}
.mark-wrap{position:absolute;left:2.1%;top:17.1%;width:18.6%;height:12.5%;display:flex;align-items:center;justify-content:center;background:#092d4d;border:1px solid rgba(113,213,236,.58);padding:.8%;box-shadow:0 10px 26px rgba(1,20,37,.28)}
.event-mark{display:block;width:100%;height:100%;object-fit:contain}
.brand{position:absolute;right:4.1%;top:3.5%;width:12.5%;height:12%;object-fit:contain;object-position:center;background:#f5f8f8;padding:.55%;border:1px solid rgba(255,255,255,.62)}
.edition{position:absolute;left:3.1%;bottom:25%;color:#eaf7fb;font-size:1.02vw;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-shadow:0 2px 12px #082744}
.edition small{display:block;margin-top:.75em;color:#69d1e4;font-size:.74em;letter-spacing:.17em}
.left-motif{position:absolute;left:31%;top:-17%;width:12%;height:134%;border:1px solid rgba(83,194,224,.18);transform:rotate(17deg);z-index:-2}
.right-panel{position:absolute;right:0;top:0;width:27.2%;height:100%;background:linear-gradient(135deg,rgba(10,55,87,.82),rgba(5,31,55,.9));border-left:1px solid rgba(98,203,226,.28)}
.right-panel:before{content:"";position:absolute;top:0;left:0;width:2px;height:100%;background:linear-gradient(transparent,#43c5df 35%,#43c5df 72%,transparent)}
.event-meta{position:absolute;right:4.35%;top:17.7%;width:18.6%;text-align:center;color:#d6e9f1}
.event-meta strong{display:block;color:#5bd0e4;font-size:.89vw;letter-spacing:.2em;text-transform:uppercase}
.event-meta span{display:block;margin-top:.42em;font-size:.85vw;letter-spacing:.13em}
.qr-frame{position:absolute;right:6.1%;top:27.1%;width:14.1%;aspect-ratio:1;background:#fff;padding:1.28%;box-shadow:0 14px 35px rgba(0,0,0,.28)}
.qr-image{display:block;width:100%;height:100%;object-fit:contain}
.qr-caption{position:absolute;right:5.35%;top:74.2%;width:15.7%;text-align:center;color:#e8f5fa;font-size:.81vw;font-weight:700;letter-spacing:.08em}
.qr-url{position:absolute;right:4.35%;top:80.3%;width:18%;text-align:center;color:#6ee0ef;font-size:.82vw;letter-spacing:.025em;text-decoration:none}
.main-copy{position:absolute;left:33.34%;top:22.7%;width:33.32%;height:57%;display:flex;flex-direction:column;align-items:center;text-align:center}
.eyebrow{font-size:.83vw;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#7fe2ed;line-height:1.2}
.headline{display:flex;align-items:baseline;justify-content:center;gap:.16em;margin-top:.1%;color:#f7fbff;font-weight:900;letter-spacing:-.075em;line-height:.96;font-size:5.2vw}
.headline b{font-weight:900;color:#50d2e5}
.headline .minus{font-size:.72em;color:#f6fbff}
.duration{margin-top:.3%;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#f2f8fc;font-size:1.32vw}
.coverage{margin-top:.85%;color:#c8e1eb;font-size:.91vw;letter-spacing:.025em}
.divider{width:17%;height:2px;margin:2.3% 0 2.2%;background:#45c7df}
.deadline{display:flex;align-items:center;justify-content:center;gap:.45em;color:#f3f8fa;font-size:1.12vw;font-weight:700;line-height:1.2}
.deadline strong{color:#72deed;font-size:1.28em}
.emailed{margin-top:1.8%;color:#cee2ec;font-size:.95vw;letter-spacing:.01em}
.eligible{position:absolute;left:30.7%;top:75.4%;width:38.6%;text-align:center;color:#c2d9e4;font-size:.75vw;line-height:1.2;letter-spacing:.005em}
.eligible strong{color:#e6f5fa;font-weight:700}
@media(max-width:700px){
 .edition{font-size:1.3vw}
 .eyebrow{letter-spacing:.12em}
 .qr-caption{font-size:1.03vw}
 .qr-url{font-size:1.05vw}
 .eligible{font-size:.85vw}
}
`;

export function Offer() {
  return (
    <>
      <style>{css}</style>
      <main className="offer" data-export-root aria-label="Offre xHACCP France pour la communauté de La Pétanque des Toqués">
        <img className="team-photo" src={photo} alt="L’équipe xHACCP réunie à La Pétanque des Toqués" />
        <div className="photo-shade" />
        <div className="photo-rule" />
        <div className="mark-wrap">
          <img className="event-mark" src={eventMark} alt="La Pétanque des Toqués" />
        </div>
        <div className="edition">10ème édition · 2026<small>Antibes · Le Fort Carré</small></div>
        <div className="left-motif" />
        <div className="right-panel" />
        <img className="brand" src={brand} alt="xHACCP France" />
        <div className="event-meta"><strong>FRANCE</strong></div>
        <div className="main-copy">
          <div className="eyebrow">Un avantage pour la communauté</div>
          <div className="headline"><span className="minus">−</span><b>20</b><span>%</span></div>
          <div className="duration">pendant 1 an</div>
          <div className="coverage">sur tous les produits xHACCP France</div>
          <div className="divider" />
          <div className="deadline"><span>1<sup>ère</sup> commande validée sous</span><strong>30 jours</strong></div>
          <div className="emailed">Votre code personnel vous sera envoyé par e-mail.</div>
        </div>
        <div className="eligible"><strong>Pour les participants, les personnes qui aiment la page Facebook de l’événement,</strong><br />et celles qui connaissent un participant.</div>
        <div className="qr-frame"><img className="qr-image" src={qr} alt="QR code pour découvrir l’offre" /></div>
        <div className="qr-caption">SCANNER POUR EN PROFITER</div>
        <a className="qr-url" href="https://xhaccp.fr/chef-event">xhaccp.fr/chef-event</a>
      </main>
    </>
  );
}