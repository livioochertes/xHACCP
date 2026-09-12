import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(scriptDir, "..");
const outputDir = path.join(artifactDir, "public/exports");
const pngPath = path.join(outputDir, "chef-event-qr-card.png");
const pdfPath = path.join(outputDir, "chef-event-qr-card.pdf");
const chromiumPath = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";

if (!existsSync(chromiumPath)) {
  throw new Error(`Chromium not found at ${chromiumPath}. Set CHROMIUM_PATH to a Chromium binary.`);
}

const registrationUrl = "https://xhaccp.fr/chef-event";
const logoDataUri = `data:image/png;base64,${readFileSync(
  path.join(artifactDir, "public/images/xhaccp-logo.png"),
).toString("base64")}`;
const qrSvg = await QRCode.toString(registrationUrl, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 0,
  color: { dark: "#111827", light: "#ffffff" },
});
const qrDataUri = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
const workDir = mkdtempSync(path.join(tmpdir(), "chef-event-export-"));
const htmlPath = path.join(workDir, "chef-event-qr-card.html");

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>xHACCP France — Offre spéciale chefs</title>
    <style>
      @page { size: 16in 9in; margin: 0; }
      :root {
        color-scheme: dark;
        font-family: Arial, Helvetica, sans-serif;
        background: #071728;
      }
      * { box-sizing: border-box; }
      html, body {
        width: 1920px;
        height: 1080px;
        margin: 0;
        overflow: hidden;
        background: #071728;
      }
      body {
        color: white;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .card {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        padding: 60px 96px 48px;
        background:
          radial-gradient(ellipse 760px 560px at 90% -10%, rgba(34, 211, 238, .16), transparent 68%),
          radial-gradient(ellipse 720px 540px at 8% 112%, rgba(29, 78, 216, .25), transparent 70%),
          #071728;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: .3;
        background-image:
          linear-gradient(rgba(148, 163, 184, .08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, .08) 1px, transparent 1px);
        background-size: 44px 44px;
      }
      .card::after {
        content: "";
        position: absolute;
        top: 132px;
        right: 34%;
        width: 16%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(103, 232, 249, .5), transparent);
      }
      .content {
        position: relative;
        z-index: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      header, footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand { display: flex; align-items: center; gap: 16px; }
      .logo-panel {
        display: flex;
        width: 170px;
        height: 58px;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 12px;
        background: white;
        padding: 8px 12px;
        box-shadow: 0 0 30px rgba(34, 211, 238, .12);
      }
      .logo-panel img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .brand-name {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: .18em;
      }
      .brand-market {
        margin-top: 4px;
        color: rgba(103, 232, 249, .8);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .32em;
      }
      .badge {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 10px 18px;
        border: 1px solid rgba(255, 255, 255, .15);
        border-radius: 999px;
        background: rgba(255, 255, 255, .05);
        color: #cbd5e1;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .2em;
        text-transform: uppercase;
      }
      .badge-star { color: #67e8f9; font-size: 16px; }
      .main {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(440px, .7fr);
        align-items: center;
        gap: 100px;
        flex: 1;
        padding: 40px 0 30px;
      }
      .eyebrow {
        margin: 0 0 22px;
        color: #67e8f9;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: .28em;
        text-transform: uppercase;
      }
      h1 {
        max-width: 900px;
        margin: 0;
        font-size: 108px;
        line-height: .9;
        letter-spacing: -.065em;
      }
      h1 span { color: #67e8f9; }
      .description {
        max-width: 700px;
        margin: 34px 0 0;
        color: #cbd5e1;
        font-size: 22px;
        line-height: 1.45;
      }
      .description strong { color: white; }
      .activation {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        max-width: 860px;
        margin-top: 28px;
        padding: 16px 18px;
        border: 2px solid rgba(103, 232, 249, .65);
        border-radius: 20px;
        background: rgba(103, 232, 249, .1);
        box-shadow: 0 0 34px rgba(34, 211, 238, .12);
      }
      .activation-icon {
        display: grid;
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 50%;
        background: #67e8f9;
        color: #071728;
        font-size: 22px;
        font-weight: 900;
      }
      .activation-title {
        color: #a5f3fc;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .activation-copy {
        margin-top: 5px;
        color: white;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.35;
      }
      .details {
        display: grid;
        grid-template-columns: repeat(3, max-content);
        gap: 26px;
        max-width: 800px;
        margin-top: 38px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, .15);
      }
      .detail {
        display: flex;
        align-items: center;
        gap: 11px;
        color: #cbd5e1;
        font-size: 15px;
        font-weight: 500;
      }
      .detail-icon {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, .15);
        border-radius: 50%;
        background: rgba(255, 255, 255, .1);
        color: #67e8f9;
        font-size: 15px;
      }
      .qr-column {
        position: relative;
        width: 100%;
        max-width: 470px;
        justify-self: end;
        text-align: center;
      }
      .qr-column::before {
        content: "";
        position: absolute;
        inset: -18px;
        border-radius: 32px;
        background: rgba(103, 232, 249, .1);
        filter: blur(24px);
      }
      .qr-panel {
        position: relative;
        padding: 28px;
        border-radius: 28px;
        background: white;
        box-shadow: 0 24px 90px rgba(0, 0, 0, .38);
      }
      .qr-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        aspect-ratio: 1;
        padding: 12px;
        border-radius: 16px;
        background: white;
      }
      .qr-wrap img { display: block; width: 100%; height: 100%; }
      .qr-title {
        margin-top: 16px;
        color: #0f172a;
        font-size: 18px;
        font-weight: 800;
      }
      .qr-subtitle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        margin-top: 8px;
        color: #64748b;
        font-size: 13px;
        font-weight: 500;
      }
      .qr-subtitle span { color: #0891b2; font-size: 18px; }
      .fallback-label {
        position: relative;
        margin-top: 16px;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: .22em;
        text-transform: uppercase;
      }
      .fallback-url {
        position: relative;
        margin-top: 4px;
        color: #67e8f9;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: .03em;
      }
      footer {
        position: relative;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, .1);
        color: #94a3b8;
        font-size: 10px;
        line-height: 1.4;
      }
      footer strong { color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="content">
        <header>
          <div class="brand">
            <div>
              <div class="logo-panel"><img src="${logoDataUri}" alt="xHACCP"></div>
              <div class="brand-market">France</div>
            </div>
          </div>
          <div class="badge"><span class="badge-star">✣</span> Offre spéciale chefs</div>
        </header>
        <main class="main">
          <section>
            <p class="eyebrow">Pour les professionnels de la restauration</p>
            <h1>Votre cuisine.<br><span>Votre avantage.</span></h1>
            <p class="description">
              Inscrivez-vous au Chef Event et recevez par email votre
              <strong>code personnel de réduction de 20&nbsp;%</strong>
              sur tous les produits xHACCP France, pendant 1 an.
            </p>
            <div class="activation">
              <div class="activation-icon">◷</div>
              <div>
                <div class="activation-title">Important - activez vite votre compte</div>
                <div class="activation-copy">Une commande dans les trentes jours = votre promotion valable pour toutes vos commandes pendant 1 an</div>
              </div>
            </div>
            <div class="details">
              <div class="detail"><span class="detail-icon">✉</span>Code envoyé par email</div>
              <div class="detail"><span class="detail-icon">◷</span>Activation par achat sous 30 jours</div>
              <div class="detail"><span class="detail-icon">♢</span>Sans montant minimum</div>
            </div>
          </section>
          <aside class="qr-column">
            <div class="qr-panel">
              <div class="qr-wrap"><img src="${qrDataUri}" alt="QR code vers ${registrationUrl}"></div>
              <div class="qr-title">Scannez pour vous inscrire</div>
              <div class="qr-subtitle">Recevez votre code personnel par email <span>↗</span></div>
            </div>
            <div class="fallback-label">Ou rendez-vous sur</div>
            <div class="fallback-url">xhaccp.fr/chef-event</div>
          </aside>
        </main>
      </div>
    </div>
  </body>
</html>`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(htmlPath, html);

const chromiumArgs = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--hide-scrollbars",
  "--run-all-compositor-stages-before-draw",
  "--virtual-time-budget=1000",
];

try {
  execFileSync(chromiumPath, [
    ...chromiumArgs,
    `--screenshot=${pngPath}`,
    "--window-size=1920,1080",
    `file://${htmlPath}`,
  ], { stdio: "inherit" });

  execFileSync(chromiumPath, [
    ...chromiumArgs,
    `--print-to-pdf=${pdfPath}`,
    "--print-to-pdf-no-header",
    `file://${htmlPath}`,
  ], { stdio: "inherit" });
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(`Wrote ${pngPath}`);
console.log(`Wrote ${pdfPath}`);