
import fs from 'fs';
import path from 'path';

const imagePath = path.join(process.cwd(), 'public', 'logoUNT.jpeg');
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;

// Write the data URL to a file
fs.writeFileSync(path.join(process.cwd(), 'logo-base64.txt'), dataUrl);
console.log('Base64 data URL written to logo-base64.txt');
console.log(`First 500 chars: ${dataUrl.substring(0, 500)}...`);
