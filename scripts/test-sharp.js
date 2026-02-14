const sharp = require('sharp');
const fs = require('fs');

async function testSharp() {
    console.log('Testing Sharp...');
    try {
        const svg = `
        <svg width="200" height="200">
            <rect width="200" height="200" fill="red" />
             <circle cx="100" cy="100" r="50" fill="blue" />
        </svg>
        `;
        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        console.log('Sharp SVG to PNG buffer success. Size:', buffer.length);

        fs.writeFileSync('test-sharp.png', buffer);
        console.log('Saved test-sharp.png');
    } catch (err) {
        console.error('Sharp failed:', err);
    }
}

testSharp();
