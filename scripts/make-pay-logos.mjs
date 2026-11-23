// Trims and resizes the payment method images into src/assets/pay.
// Usage: node scripts/make-pay-logos.mjs <zelle-image> <venmo-image> <card-image>
import sharp from 'sharp';

const [zelle, venmo, card] = process.argv.slice(2);
if (!zelle || !venmo || !card) {
  console.error('Usage: node scripts/make-pay-logos.mjs <zelle-image> <venmo-image> <card-image>');
  process.exit(1);
}

const jobs = [
  { input: zelle, output: 'zelle.png', height: 96 },
  { input: venmo, output: 'venmo.png', height: 72 },
  { input: card, output: 'card.png', height: 72 },
];

for (const { input, output, height } of jobs) {
  await sharp(input)
    .trim()
    .resize({ height })
    .png({ compressionLevel: 9 })
    .toFile(`src/assets/pay/${output}`);
}
