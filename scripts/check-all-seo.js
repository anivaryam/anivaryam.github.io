#!/usr/bin/env node
/**
 * Check all pages for SEO consistency
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const srcDir = path.join(__dirname, '..', 'src', 'pages');

// Expected metadata from generate-static-routes.js
const routeMetadata = {
  '/': {
    title: 'Free Developer Tools - Conversion & Formatting',
    description: 'Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation. No signup, fast & privacy-friendly.'
  },
  '/tools': {
    title: 'Free Online Developer Tools - 20+ Tools',
    description: 'Browse 20+ free online developer tools. Word to HTML converter, JSON formatter, Base64 encoder, hash generator, web scraper, and more. No signup required.'
  },
  '/blogs': {
    title: 'Developer Blog & Tutorials',
    description: 'Tutorials, tips, and developer resources. Learn about web scraping, cryptography, post-quantum security, and more developer topics.'
  },
  '/news': {
    title: 'Latest News & Updates',
    description: 'Latest updates, announcements, and feature highlights from Anivaryam. Stay informed about new tools, bug fixes, and improvements.'
  },
  '/downloads': {
    title: 'Free Downloads & Scripts',
    description: 'Downloadable scripts and utilities for Windows, PERN setup, and more. Free developer tools including Microsoft Script and PostgreSQL Manager.'
  },
  '/about': {
    title: 'About Anivaryam',
    description: 'Learn more about Anivaryam and my mission. Developer tools made simple, built by a developer for developers. Free, open-source, and community-driven.'
  },
  '/school-projects': {
    title: 'School Projects',
    description: 'Ready-to-use project templates for students. Logic gates calculator, audio bandpass filter, and other educational projects with source code.'
  },
  '/issues': {
    title: 'Report Issues & Share Feedback',
    description: 'Report bugs, request features, and share feedback for Anivaryam. Help me improve my developer tools through GitHub Issues.'
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

function checkReactComponent(route, filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, hasSEO: false, hasCanonical: false, hasStructuredData: false };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasSEO = content.includes('<SEO');
  const hasCanonical = content.includes('canonical=');
  const hasStructuredData = content.includes('structuredData');
  
  return { exists: true, hasSEO, hasCanonical, hasStructuredData };
}

function verifyRoute(route) {
  const routePath = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
  const htmlPath = path.join(distDir, routePath);
  
  const results = {
    route,
    htmlExists: false,
    titleMatch: false,
    descriptionMatch: false,
    title: null,
    description: null,
    expectedTitle: null,
    expectedDescription: null,
    reactComponent: null,
    reactHasSEO: false,
    reactHasCanonical: false,
    reactHasStructuredData: false
  };
  
  // Check HTML file
  if (fs.existsSync(htmlPath)) {
    results.htmlExists = true;
    const html = fs.readFileSync(htmlPath, 'utf-8');
    results.title = getTitle(html);
    results.description = getDescription(html);
    
    const expected = routeMetadata[route];
    if (expected) {
      results.expectedTitle = expected.title;
      results.expectedDescription = expected.description;
      
      // For pages with brand, check if title includes brand or matches base title
      const titleMatch = results.title === expected.title || 
                        results.title === `${expected.title} | Anivaryam` ||
                        (route === '/' && results.title === expected.title);
      results.titleMatch = titleMatch;
      results.descriptionMatch = results.description === expected.description;
    }
  }
  
  // Check React component
  let reactFile = null;
  if (route === '/') {
    reactFile = path.join(srcDir, 'Index.tsx');
  } else {
    const componentName = route.slice(1).split('/').map(part => 
      part.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')
    ).join('');
    reactFile = path.join(srcDir, `${componentName.charAt(0).toUpperCase()}${componentName.slice(1)}.tsx`);
  }
  
  // Try alternative naming
  if (!fs.existsSync(reactFile) && route !== '/') {
    const altNames = [
      path.join(srcDir, route.slice(1).split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') + '.tsx'),
      path.join(srcDir, route.slice(1) + '.tsx'),
    ];
    for (const alt of altNames) {
      if (fs.existsSync(alt)) {
        reactFile = alt;
        break;
      }
    }
  }
  
  if (fs.existsSync(reactFile)) {
    results.reactComponent = path.relative(srcDir, reactFile);
    const reactCheck = checkReactComponent(route, reactFile);
    results.reactHasSEO = reactCheck.hasSEO;
    results.reactHasCanonical = reactCheck.hasCanonical;
    results.reactHasStructuredData = reactCheck.hasStructuredData;
  }
  
  return results;
}

console.log('🔍 Checking all pages for SEO consistency...\n');

const routes = Object.keys(routeMetadata);
const results = routes.map(route => verifyRoute(route));

let allGood = true;

results.forEach(result => {
  const issues = [];
  
  if (!result.htmlExists) {
    issues.push('❌ HTML file missing');
    allGood = false;
  }
  
  if (!result.titleMatch && result.htmlExists) {
    issues.push(`❌ Title mismatch: "${result.title}" vs "${result.expectedTitle}"`);
    allGood = false;
  }
  
  if (!result.descriptionMatch && result.htmlExists) {
    issues.push(`❌ Description mismatch`);
    allGood = false;
  }
  
  if (!result.reactComponent) {
    issues.push('⚠️  React component not found');
  } else {
    if (!result.reactHasSEO) {
      issues.push('❌ React component missing <SEO>');
      allGood = false;
    }
    if (!result.reactHasCanonical) {
      issues.push('⚠️  React component missing canonical URL');
    }
    if (!result.reactHasStructuredData) {
      issues.push('⚠️  React component missing structuredData');
    }
  }
  
  const status = issues.length === 0 ? '✅' : issues[0].startsWith('❌') ? '❌' : '⚠️';
  
  console.log(`${status} ${result.route}`);
  if (result.htmlExists) {
    console.log(`   HTML Title: ${result.title}`);
    console.log(`   HTML Desc: ${result.description?.substring(0, 60)}...`);
  }
  if (result.reactComponent) {
    console.log(`   React: ${result.reactComponent}`);
    console.log(`   SEO: ${result.reactHasSEO ? '✅' : '❌'} | Canonical: ${result.reactHasCanonical ? '✅' : '❌'} | StructuredData: ${result.reactHasStructuredData ? '✅' : '❌'}`);
  }
  if (issues.length > 0) {
    issues.forEach(issue => console.log(`   ${issue}`));
  }
  console.log('');
});

console.log(`\n📊 Summary: ${allGood ? '✅ All pages OK' : '❌ Some issues found'}`);

process.exit(allGood ? 0 : 1);

