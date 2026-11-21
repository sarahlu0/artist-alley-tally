// Crops and shrinks the payment logos into src/assets/pay.
// Usage: node scripts/make-pay-logos.mjs <folder with 3.png 4.webp 5.png>
import sharp from 'sharp';

const dir = process.argv[2];
const jobs = [
  { file: '3.png', out: 'zelle.png', height: 96 },
  { file: '4.webp', out: 'venmo.png', height: 72 },
  { file: '5.png', out: 'card.png', height: 72 },
];

for (const job of jobs) {
  await sharp(`${dir}/${job.file}`)
    .trim()
    .resize({ height: job.height })
    .png({ compressionLevel: 9 })
    .toFile(`src/assets/pay/${job.out}`);
}
