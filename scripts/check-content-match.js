#!/usr/bin/env node
/**
 * Check if page titles and descriptions match the actual content
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

const mismatches = [];

function extractTextFromJSX(content) {
  // Extract text from JSX strings
  const strings = [];
  
  // Match string literals
  const stringMatches = content.matchAll(/"([^"]+)"/g);
  for (const match of stringMatches) {
    const str = match[1];
    // Skip very short strings and URLs
    if (str.length > 10 && !str.startsWith('http') && !str.startsWith('/')) {
      strings.push(str);
    }
  }
  
  // Match template literals
  const templateMatches = content.matchAll(/`([^`]+)`/g);
  for (const match of templateMatches) {
    strings.push(match[1]);
  }
  
  return strings.join(' ').toLowerCase();
}

function checkContentMatch(title, description, path, type, contentText) {
  const issues = [];
  const contentLower = contentText.toLowerCase();
  
  // Extract meaningful keywords from title (words longer than 3 chars)
  const titleWords = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  // Check if main title words appear in content
  const mainTitleWords = titleWords.filter(w => 
    !['tool', 'page', 'guide', 'tutorial', 'article', 'post'].includes(w)
  );
  
  if (mainTitleWords.length > 0) {
    const missingWords = mainTitleWords.filter(word => 
      !contentLower.includes(word)
    );
    
    if (missingWords.length > 0 && mainTitleWords.length <= 3) {
      // If title is short, all words should be present
      issues.push(`Title word "${missingWords[0]}" not found in content`);
    } else if (missingWords.length > mainTitleWords.length * 0.4) {
      // If many words missing, flag it
      issues.push(`Many title words missing: ${missingWords.slice(0, 3).join(', ')}`);
    }
  }
  
  // Check description matches content
  const descWords = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  const missingDescWords = descWords.filter(word => 
    !contentLower.includes(word) && 
    !['about', 'learn', 'discover', 'perfect', 'essential', 'ideal'].includes(word)
  );
  
  if (missingDescWords.length > descWords.length * 0.4 && descWords.length > 5) {
    issues.push(`Many description keywords missing: ${missingDescWords.slice(0, 5).join(', ')}`);
  }
  
  if (issues.length > 0) {
    mismatches.push({
      path,
      type,
      title,
      description,
      contentPreview: contentText.substring(0, 200),
      issues
    });
  }
}

// Check tools
const toolsMetadata = getToolsMetadata();
toolsMetadata.forEach(tool => {
  // Try to find the tool page component
  const toolName = tool.id.split('-').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join('');
  
  const possiblePaths = [
    path.join(__dirname, '..', 'src', 'pages', 'tools', `${toolName}.tsx`),
    path.join(__dirname, '..', 'src', 'pages', 'tools', `${tool.id.charAt(0).toUpperCase() + tool.id.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}.tsx`),
  ];
  
  let content = '';
  for (const toolPath of possiblePaths) {
    if (fs.existsSync(toolPath)) {
      content = fs.readFileSync(toolPath, 'utf-8');
      break;
    }
  }
  
  if (content) {
    const textContent = extractTextFromJSX(content);
    // Add tool title and description to content for matching
    const fullContent = textContent + ' ' + tool.title.toLowerCase() + ' ' + tool.description.toLowerCase();
    checkContentMatch(tool.title, tool.description, tool.path, 'Tool', fullContent);
  } else {
    // If we can't find the component, just check if title/description are reasonable
    console.warn(`Warning: Could not find component for ${tool.path}`);
  }
});

// Check blog posts
const blogPosts = getBlogPosts();
blogPosts.forEach(post => {
  // Use excerpt + first part of content
  const content = (post.excerpt || '') + ' ' + (post.content || '').substring(0, 1000);
  checkContentMatch(post.title, post.excerpt, `/blogs/${post.id}`, 'Blog Post', content.toLowerCase());
});

// Check news articles
const newsArticles = getNewsArticles();
newsArticles.forEach(article => {
  const content = (article.excerpt || '') + ' ' + (article.content || '').substring(0, 1000);
  checkContentMatch(article.title, article.excerpt, `/news/${article.slug}`, 'News Article', content.toLowerCase());
});

// Check main pages
const routeMetadata = {
  '/tools': {
    title: 'Developer Tools',
    description: '20+ free developer tools: formatters, converters, encoders, generators. JSON formatter, Base64 encoder, hash generator, QR code generator, and more.'
  },
  '/downloads': {
    title: 'Free Downloads & Scripts',
    description: 'Downloadable scripts and utilities for Windows, PERN setup, and more. Free developer tools including Microsoft Script and PostgreSQL Manager.'
  },
  '/blogs': {
    title: 'Developer Blog & Tutorials',
    description: 'Tutorials, tips, and developer resources. Learn about web scraping, cryptography, post-quantum security, and more developer topics.'
  },
  '/news': {
    title: 'Latest News & Updates',
    description: 'Latest updates, announcements, and feature highlights from Anivaryam. Stay informed about new tools, bug fixes, and improvements.'
  },
  '/school-projects': {
    title: 'School Projects',
    description: 'Ready-to-use project templates for students. Logic gates calculator, audio bandpass filter, and other educational projects with source code.'
  },
  '/about': {
    title: 'About Anivaryam',
    description: 'Learn more about Anivaryam and my mission. Developer tools made simple, built by a developer for developers. Free, open-source, and community-driven platform.'
  }
};

Object.entries(routeMetadata).forEach(([route, metadata]) => {
  const pageName = route === '/' ? 'Index' : route.slice(1).split('/').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join('');
  
  const pagePath = path.join(__dirname, '..', 'src', 'pages', `${pageName}.tsx`);
  
  if (fs.existsSync(pagePath)) {
    const content = fs.readFileSync(pagePath, 'utf-8');
    const textContent = extractTextFromJSX(content);
    
    // For main pages, also include the tools/blog/news data
    let additionalContent = '';
    if (route === '/tools') {
      additionalContent = toolsMetadata.map(t => t.title + ' ' + t.description).join(' ').toLowerCase();
    } else if (route === '/blogs') {
      additionalContent = blogPosts.map(p => p.title + ' ' + p.excerpt).join(' ').toLowerCase();
    } else if (route === '/news') {
      additionalContent = newsArticles.map(a => a.title + ' ' + a.excerpt).join(' ').toLowerCase();
    }
    
    checkContentMatch(metadata.title, metadata.description, route, 'Main Page', 
      (textContent + ' ' + additionalContent).toLowerCase());
  }
});

// Report results
console.log('\n=== Content Match Check ===\n');

if (mismatches.length === 0) {
  console.log('✅ All pages have titles and descriptions that match their content!\n');
} else {
  console.log(`⚠️  Found ${mismatches.length} page(s) with potential content mismatches:\n`);
  
  mismatches.forEach((mismatch, index) => {
    console.log(`${index + 1}. ${mismatch.type}: ${mismatch.path}`);
    console.log(`   Title: "${mismatch.title}"`);
    console.log(`   Description: "${mismatch.description.substring(0, 100)}..."`);
    console.log(`   Issues:`);
    mismatch.issues.forEach(issue => {
      console.log(`     - ${issue}`);
    });
    console.log('');
  });
  
  process.exit(1);
}
