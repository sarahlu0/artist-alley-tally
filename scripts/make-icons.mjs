// Rasterises public/favicon.svg into the PNG icons the installed app needs.
// Run with `node scripts/make-icons.mjs` after changing the logo.
import sharp from 'sharp';

const source = 'public/favicon.svg';
const navy = '#23408e';

await sharp(source, { density: 600 }).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(source, { density: 600 }).resize(512, 512).png().toFile('public/icon-512.png');

// Maskable and Apple icons get cropped by the OS, so the mark sits inside a solid square.
async function padded(size, inner, file) {
  const mark = await sharp(source, { density: 600 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(file);
}
await padded(512, 400, 'public/icon-maskable.png');
await padded(180, 164, 'public/apple-touch-icon.png');
