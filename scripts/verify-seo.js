#!/usr/bin/env node
/**
 * Verify SEO meta tags match between static HTML and React components
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

// Expected values
const expected = {
  '/': {
    title: 'Free Developer Tools - Conversion & Formatting',
    description: 'Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation. No signup, fast & privacy-friendly.'
  },
  '/tools': {
    title: 'Free Online Developer Tools - 23+ Tools',
    description: 'Browse 23+ free online developer tools. Word to HTML converter, JSON formatter, Base64 encoder, hash generator, web scraper, and more. No signup required.'
  }
};

function getTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

function getDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/);
  return match ? match[1].replace(/&amp;/g, '&') : null;
}

function verifyRoute(route) {
  const routePath = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
  const filePath = path.join(distDir, routePath);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${route}: File not found: ${filePath}`);
    return false;
  }
  
  const html = fs.readFileSync(filePath, 'utf-8');
  const title = getTitle(html);
  const description = getDescription(html);
  const expectedTitle = expected[route].title;
  const expectedDesc = expected[route].description;
  
  const titleMatch = title === expectedTitle;
  const descMatch = description === expectedDesc;
  
  console.log(`\n${route}:`);
  console.log(`  Title: ${titleMatch ? '✅' : '❌'} ${title}`);
  console.log(`    Expected: ${expectedTitle}`);
  console.log(`  Description: ${descMatch ? '✅' : '❌'} ${description?.substring(0, 60)}...`);
  console.log(`    Expected: ${expectedDesc.substring(0, 60)}...`);
  
  // Check for homepage content in wrong files (only in body, not meta tags)
  if (route !== '/') {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      if (bodyContent.includes('Free Developer Tools - Conversion')) {
        console.log(`  ⚠️  WARNING: Homepage content found in ${route}!`);
        return false;
      }
    }
  }
  
  return titleMatch && descMatch;
}

console.log('🔍 Verifying SEO meta tags...\n');

const homepageOk = verifyRoute('/');
const toolsOk = verifyRoute('/tools');
const removedRoute = '/tools/related-product-finder';
const removedToolOk =
  !fs.existsSync(path.join(distDir, removedRoute.slice(1))) &&
  !fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf-8').includes(removedRoute) &&
  !fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf-8').includes(removedRoute);

console.log(`\n📊 Summary:`);
console.log(`  Homepage: ${homepageOk ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Tools: ${toolsOk ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Removed tool route and sitemap: ${removedToolOk ? '✅ PASS' : '❌ FAIL'}`);

if (homepageOk && toolsOk && removedToolOk) {
  console.log(`\n✅ All checks passed! Files are ready for deployment.`);
  process.exit(0);
} else {
  console.log(`\n❌ Some checks failed. Please review the output above.`);
  process.exit(1);
}
