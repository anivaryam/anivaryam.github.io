#!/usr/bin/env node
/**
 * Check all pages for SEO requirements:
 * - Title: 30-60 characters (including " | Anivaryam" suffix)
 * - Description: 120-160 characters
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getBlogPosts,
  getNewsArticles,
  getToolsMetadata,
  baseUrl
} from './enhance-html-for-bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const siteName = "Anivaryam";
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 160;

const issues = [];

function checkPage(title, description, path, type) {
  const fullTitle = title === "Home" ? siteName : `${title} | ${siteName}`;
  const titleLen = fullTitle.length;
  const descLen = description.length;
  
  const pageIssues = [];
  
  if (titleLen < TITLE_MIN) {
    pageIssues.push(`Title too short: ${titleLen} chars (min: ${TITLE_MIN})`);
  }
  if (titleLen > TITLE_MAX) {
    pageIssues.push(`Title too long: ${titleLen} chars (max: ${TITLE_MAX})`);
  }
  if (descLen < DESC_MIN) {
    pageIssues.push(`Description too short: ${descLen} chars (min: ${DESC_MIN})`);
  }
  if (descLen > DESC_MAX) {
    pageIssues.push(`Description too long: ${descLen} chars (max: ${DESC_MAX})`);
  }
  
  if (pageIssues.length > 0) {
    issues.push({
      path,
      type,
      title: fullTitle,
      description,
      titleLen,
      descLen,
      problems: pageIssues
    });
  }
  
  return pageIssues.length === 0;
}

// Check home page
const indexHtml = path.join(__dirname, '..', 'index.html');
if (fs.existsSync(indexHtml)) {
  const content = fs.readFileSync(indexHtml, 'utf-8');
  const titleMatch = content.match(/<title>([^<]+)<\/title>/);
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/);
  
  if (titleMatch && descMatch) {
    const title = titleMatch[1];
    const description = descMatch[1];
    checkPage(title.replace(` | ${siteName}`, ''), description, '/', 'Home');
  }
}

// Check tools
const toolsMetadata = getToolsMetadata();
toolsMetadata.forEach(tool => {
  checkPage(tool.title, tool.description, tool.path, 'Tool');
});

// Check blog posts
const blogPosts = getBlogPosts();
blogPosts.forEach(post => {
  checkPage(post.title, post.excerpt, `/blogs/${post.id}`, 'Blog Post');
});

// Check news articles
const newsArticles = getNewsArticles();
newsArticles.forEach(article => {
  checkPage(article.title, article.excerpt, `/news/${article.slug}`, 'News Article');
});

// Check main pages
const routeMetadata = {
  '/tools': {
    title: 'Developer Tools',
    description: '20+ free developer tools: formatters, converters, encoders, generators. JSON formatter, Base64 encoder, hash generator, QR code generator, and more.'
  },
  '/downloads': {
    title: 'Downloads',
    description: 'Downloadable scripts and utilities for Windows, PERN setup, and more. Free developer tools including Microsoft Script and PostgreSQL Manager.'
  },
  '/blogs': {
    title: 'Blog',
    description: 'Tutorials, tips, and developer resources. Learn about web scraping, cryptography, post-quantum security, and more developer topics.'
  },
  '/news': {
    title: 'News',
    description: 'Latest updates, announcements, and feature highlights from Anivaryam. Stay informed about new tools, bug fixes, and improvements.'
  },
  '/school-projects': {
    title: 'School Projects',
    description: 'Ready-to-use project templates for students. Logic gates calculator, audio bandpass filter, and other educational projects with source code.'
  },
  '/about': {
    title: 'About',
    description: 'Learn more about Anivaryam and my mission. Developer tools made simple, built by a developer for developers.'
  }
};

Object.entries(routeMetadata).forEach(([route, metadata]) => {
  checkPage(metadata.title, metadata.description, route, 'Main Page');
});

// Report results
console.log('\n=== SEO Requirements Check ===\n');
console.log(`Requirements:`);
console.log(`  Title: ${TITLE_MIN}-${TITLE_MAX} characters (including " | ${siteName}")`);
console.log(`  Description: ${DESC_MIN}-${DESC_MAX} characters\n`);

if (issues.length === 0) {
  console.log('✅ All pages meet SEO requirements!\n');
} else {
  console.log(`❌ Found ${issues.length} page(s) with issues:\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.type}: ${issue.path}`);
    console.log(`   Title (${issue.titleLen} chars): "${issue.title}"`);
    console.log(`   Description (${issue.descLen} chars): "${issue.description}"`);
    console.log(`   Problems:`);
    issue.problems.forEach(problem => {
      console.log(`     - ${problem}`);
    });
    console.log('');
  });
  
  process.exit(1);
}

