const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSizes = [
  { size: 16, name: 'icon-16.png' },
  { size: 32, name: 'icon-32.png' },
  { size: 96, name: 'icon-96.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

const inputIcon = path.join(__dirname, '..', 'public', 'icons', 'icon.png');
const outputDir = path.join(__dirname, '..', 'public', 'icons');

async function generateIcons() {
  try {
    // Check if source icon exists
    if (!fs.existsSync(inputIcon)) {
      console.error(`Error: Source icon not found at ${inputIcon}`);
      process.exit(1);
    }

    console.log('Generating icon sizes...');
    
    // Generate all icon sizes
    for (const { size, name } of iconSizes) {
      const outputPath = path.join(outputDir, name);
      await sharp(inputIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    // Generate favicon.ico (32x32) - Next.js automatically picks this up from app/favicon.ico
    const faviconPath = path.join(__dirname, '..', 'app', 'favicon.ico');
    const faviconPng = path.join(outputDir, 'favicon-temp.png');
    
    await sharp(inputIcon)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(faviconPng);
    
    // Convert PNG to ICO format (simple approach - copy PNG as ICO)
    // Note: For a proper ICO file, you'd need a library like 'to-ico', but Next.js accepts PNG as favicon.ico
    fs.copyFileSync(faviconPng, faviconPath);
    fs.unlinkSync(faviconPng);
    
    console.log('✓ Generated favicon.ico');
    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

