import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { writeFileSync } from 'fs';
import https from 'https';

export async function setupStockfish() {
  const publicDir = join(process.cwd(), 'public');
  const targetFile = join(publicDir, 'stockfish.js');

  // Create public directory if it doesn't exist
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  // Download stockfish.js from CDN
  return new Promise((resolve, reject) => {
    https.get('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js', (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        try {
          writeFileSync(targetFile, data);
          console.log('Successfully downloaded and saved Stockfish.js');
          resolve(true);
        } catch (error) {
          console.error('Error saving Stockfish.js:', error);
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('Error downloading Stockfish.js:', error);
      reject(error);
    });
  });
}