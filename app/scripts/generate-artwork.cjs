// Rebuild the original vector mark into platform assets; no external imagery or fonts.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
async function render(name, size, background) {
  let image = sharp(path.join(root, 'assets/images/cadence-mark.svg')).resize(size, size);
  if (background) image = image.flatten({ background });
  await fs.writeFile(path.join(root, 'assets/images', name), await image.png().toBuffer());
}
async function main() {
  await render('icon.png', 1024, '#0E5A63');
  await render('android-icon-foreground.png', 1024);
  await render('android-icon-monochrome.png', 1024);
  await render('splash-icon.png', 512);
  await render('favicon.png', 64, '#0E5A63');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
