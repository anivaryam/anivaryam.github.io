#!/usr/bin/env node
/**
 * Test SEO meta tags locally by fetching HTML files
 */
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const port = 8080;

function getTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

function getDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
    req.end();
  });
}

async function testRoute(path, expectedTitle, expectedDesc) {
  try {
    console.log(`\nTesting ${path}...`);
    const html = await fetchUrl(path);
    const title = getTitle(html);
    const description = getDescription(html);
    
    const titleMatch = title === expectedTitle;
    const descMatch = description === expectedDesc;
    
    console.log(`  Title: ${titleMatch ? '✅' : '❌'} ${title}`);
    console.log(`    Expected: ${expectedTitle}`);
    console.log(`  Description: ${descMatch ? '✅' : '❌'} ${description?.substring(0, 60)}...`);
    console.log(`    Expected: ${expectedDesc.substring(0, 60)}...`);
    
    // Check for wrong content
    if (path === '/tools/' && html.includes('Free Developer Tools - Conversion')) {
      console.log('  ⚠️  WARNING: Homepage content found in Tools page!');
      return false;
    }
    
    return titleMatch && descMatch;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    console.log(`  Make sure server is running: npm run serve:dist`);
    return false;
  }
}

console.log('🧪 Testing SEO meta tags locally...');
console.log(`\nMake sure the server is running on port ${port}:`);
console.log('  npm run serve:dist');
console.log('\nWaiting 2 seconds for server to be ready...\n');

setTimeout(async () => {
  const homepageOk = await testRoute(
    '/',
    'Free Developer Tools - Conversion & Formatting',
    'Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation. No signup, fast & privacy-friendly.'
  );
  
  const toolsOk = await testRoute(
    '/tools/',
    'Free Online Developer Tools - 24+ Tools',
    'Browse 24+ free online developer tools. Word to HTML converter, JSON formatter, Base64 encoder, hash generator, web scraper, and more. No signup required.'
  );
  
  console.log(`\n📊 Summary:`);
  console.log(`  Homepage: ${homepageOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Tools: ${toolsOk ? '✅ PASS' : '❌ FAIL'}`);
  
  if (homepageOk && toolsOk) {
    console.log(`\n✅ All tests passed! Ready for deployment.`);
    process.exit(0);
  } else {
    console.log(`\n❌ Some tests failed. Please review the output above.`);
    process.exit(1);
  }
}, 2000);
