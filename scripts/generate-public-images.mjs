import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "client/public/images");
const logo = path.join(root, "attached_assets/logo_xHACCP-S1_1772812623761.png");
const cards = [
  "chef_checking_kitchen_inventory",
  "business_consulting_meeting_chef",
  "chef_using_tablet_management",
  "support_representative_video_call",
];

await mkdir(output, { recursive: true });
for (const width of [100, 200, 300]) {
  await sharp(logo).resize({ width }).webp({ quality: 85 })
    .toFile(path.join(output, `xhaccp-logo-${width}.webp`));
}
for (const name of cards) {
  for (const width of [320, 640, 960]) {
    await sharp(path.join(root, `attached_assets/generated_images/${name}.png`))
      .resize({ width }).webp({ quality: 78 })
      .toFile(path.join(output, `${name}-${width}.webp`));
  }
}

// A language-neutral branded card, using the existing logo, for every market.
// JPEG is widely supported by social crawlers; WebP variants are for browsers.
const previewLogo = await sharp(logo).resize({ width: 900 }).png().toBuffer();
await sharp({
  create: { width: 1200, height: 630, channels: 3, background: "#ffffff" },
}).composite([{ input: previewLogo, gravity: "centre" }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(root, "client/public/og-image.jpg"));
console.log("Generated public logo, card variants and social preview.");