#!/usr/bin/env node
/**
 * Generate static HTML files for each route to prevent 404s on GitHub Pages
 * Enhanced with meta tags, structured data, and pre-rendered content for AI bots
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getBlogPosts,
  getNewsArticles,
  getToolsMetadata,
  generateBlogPostStructuredData,
  generateNewsArticleStructuredData,
  generateToolStructuredData,
  generatePageStructuredData,
  injectMetaTags,
  preRenderBlogPostContent,
  preRenderNewsArticleContent,
  preRenderToolContent,
  preRenderHomepageContent,
  preRenderMainPageContent,
  baseUrl
} from './enhance-html-for-bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distDir, 'index.html');
const blogPostsFile = path.join(__dirname, '..', 'src', 'data', 'blogPosts.ts');
const newsFile = path.join(__dirname, '..', 'src', 'data', 'news.ts');

/**
 * Extract blog post IDs from blogPosts.ts file
 */
function getBlogPostIds() {
  try {
    const content = fs.readFileSync(blogPostsFile, 'utf-8');
    // Match all id: "..." patterns
    const idMatches = content.matchAll(/id:\s*"([^"]+)"/g);
    const ids = Array.from(idMatches, match => match[1]);
    return ids;
  } catch (error) {
    console.warn('Warning: Could not read blogPosts.ts, skipping blog post routes');
    return [];
  }
}

/**
 * Extract news article slugs from news.ts file
 */
function getNewsArticleSlugs() {
  try {
    const content = fs.readFileSync(newsFile, 'utf-8');
    // Match all slug: "..." patterns
    const slugMatches = content.matchAll(/slug:\s*"([^"]+)"/g);
    const slugs = Array.from(slugMatches, match => match[1]);
    return slugs;
  } catch (error) {
    console.warn('Warning: Could not read news.ts, skipping news article routes');
    return [];
  }
}

// Routes that need static HTML files
const routes = [
  '/',
  '/issues',
  '/tools',
  '/tools/word-to-html',
  '/tools/json-formatter',
  '/tools/base64',
  '/tools/url-encoder',
  '/tools/color-converter',
  '/tools/uuid-generator',
  '/tools/regex-tester',
  '/tools/hash-generator',
  '/tools/hash-decoder',
  '/tools/jwt-decoder',
  '/tools/jwt-encoder',
  '/tools/timestamp-converter',
  '/tools/web-scraper',
  '/tools/json-extractor',
  '/tools/qr-code-generator',
  '/tools/text-diff',
  '/tools/csv-to-json',
  '/tools/image-tool',
  '/tools/random-universe-cipher',
  '/tools/listicle-template',
  '/downloads',
  '/blogs',
  '/news',
  '/school-projects',
  '/about',
  '/faq',
];

// Add blog post routes dynamically
const blogPostIds = getBlogPostIds();
blogPostIds.forEach(id => {
  routes.push(`/blogs/${id}`);
});

// Add news article routes dynamically
const newsArticleSlugs = getNewsArticleSlugs();
newsArticleSlugs.forEach(slug => {
  routes.push(`/news/${slug}`);
});

if (!fs.existsSync(indexHtml)) {
  console.error('Error: index.html not found in dist directory');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexHtml, 'utf-8');

// Load blog posts, news articles, and tools metadata
const blogPosts = getBlogPosts();
const newsArticles = getNewsArticles();
const toolsMetadata = getToolsMetadata();

// Create lookup maps for quick access
const blogPostsMap = new Map(blogPosts.map(post => [post.id, post]));
const newsArticlesMap = new Map(newsArticles.map(article => [article.slug, article]));
const toolsMap = new Map(toolsMetadata.map(tool => [tool.path, tool]));

// Route metadata for better SEO and bot accessibility
const routeMetadata = {
  '/tools': {
    title: 'Free Online Developer Tools - 20+ Tools',
    description: 'Browse 20+ free online developer tools. Word to HTML converter, JSON formatter, Base64 encoder, hash generator, web scraper, and more. No signup required.'
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
    description: 'Learn more about Anivaryam and my mission. Developer tools made simple, built by a developer for developers. Free, open-source, and community-driven.'
  },
  '/faq': {
    title: 'FAQ - Frequently Asked Questions',
    description: 'Find answers to common questions about Anivaryam free developer tools, privacy, usage, and more. Learn how to use Word to HTML converter, JSON formatter, and other tools.',
    ogImage: '/og-image.png'
  },
  '/': {
    title: 'Free Developer Tools - Conversion & Formatting',
    description: 'Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation. No signup, fast & privacy-friendly.'
  },
  '/issues': {
    title: 'Report Issues & Share Feedback',
    description: 'Report bugs, request features, and share feedback for Anivaryam. Help me improve my developer tools through GitHub Issues.'
  }
};

/**
 * Enhance HTML with route-specific metadata, structured data, and pre-rendered content
 */
function enhanceHtmlForRoute(html, route) {
  let enhancedHtml = html;
  
  // Check if this is a blog post route
  if (route.startsWith('/blogs/')) {
    const postId = route.replace('/blogs/', '');
    const post = blogPostsMap.get(postId);
    
    if (post) {
      // Remove existing noscript blocks from base template
      enhancedHtml = enhancedHtml.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
      
      // Inject meta tags and structured data
      const structuredData = generateBlogPostStructuredData(post);
      enhancedHtml = injectMetaTags(enhancedHtml, {
        title: post.title,
        description: post.excerpt,
        ogImage: post.image
      }, route, structuredData);
      
      // Pre-render blog post content
      const preRenderedContent = preRenderBlogPostContent(post);
      enhancedHtml = enhancedHtml.replace('<div id="root"></div>', `${preRenderedContent}<div id="root"></div>`);
      
      return enhancedHtml;
    }
  }
  
  // Check if this is a news article route
  if (route.startsWith('/news/')) {
    const articleSlug = route.replace('/news/', '');
    const article = newsArticlesMap.get(articleSlug);
    
    if (article) {
      // Remove existing noscript blocks from base template
      enhancedHtml = enhancedHtml.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
      
      // Inject meta tags and structured data
      const structuredData = generateNewsArticleStructuredData(article);
      enhancedHtml = injectMetaTags(enhancedHtml, {
        title: article.title,
        description: article.excerpt,
        ogImage: article.image
      }, route, structuredData);
      
      // Pre-render news article content
      const preRenderedContent = preRenderNewsArticleContent(article);
      enhancedHtml = enhancedHtml.replace('<div id="root"></div>', `${preRenderedContent}<div id="root"></div>`);
      
      return enhancedHtml;
    }
  }
  
  // Check if this is a tool route
  const tool = toolsMap.get(route);
  if (tool) {
    // Remove existing noscript blocks from base template
    enhancedHtml = enhancedHtml.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
    
    // Inject meta tags and structured data
    const structuredData = generateToolStructuredData(tool);
    enhancedHtml = injectMetaTags(enhancedHtml, {
      title: tool.title,
      description: tool.description
    }, route, structuredData);
    
    // Pre-render tool content
    const preRenderedContent = preRenderToolContent(tool);
    enhancedHtml = enhancedHtml.replace('<div id="root"></div>', `${preRenderedContent}<div id="root"></div>`);
    
    return enhancedHtml;
  }
  
  // Handle main pages
  const metadata = routeMetadata[route];
  if (metadata) {
    // For homepage, use WebSite schema; for other pages, use WebPage schema
    let structuredData;
    if (route === '/') {
      const today = new Date().toISOString().split('T')[0];
      structuredData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Anivaryam",
        "description": metadata.description,
        "url": baseUrl,
        "datePublished": today,
        "dateModified": today,
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${baseUrl}/tools?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        }
      };
    } else {
      structuredData = generatePageStructuredData(route, metadata);
    }
    enhancedHtml = injectMetaTags(enhancedHtml, metadata, route, structuredData);
    
    // Remove existing noscript blocks from base template
    enhancedHtml = enhancedHtml.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
    
    // Pre-render content for bots and search engines
    let preRenderedContent;
    if (route === '/') {
      preRenderedContent = preRenderHomepageContent(metadata);
    } else {
      preRenderedContent = preRenderMainPageContent(route, metadata);
    }
    
    enhancedHtml = enhancedHtml.replace('<div id="root"></div>', `${preRenderedContent}<div id="root"></div>`);
  }
  
  return enhancedHtml;
}

// Create directory structure and copy index.html for each route
routes.forEach(route => {
  // Remove leading slash and split path
  const routePath = route.startsWith('/') ? route.slice(1) : route;
  const routeDir = path.join(distDir, routePath);
  
  // Create directory if it doesn't exist
  fs.mkdirSync(routeDir, { recursive: true });
  
  // Copy and enhance index.html for route directory
  let routeHtmlContent = indexContent;
  routeHtmlContent = enhanceHtmlForRoute(routeHtmlContent, route);
  
  const routeHtml = path.join(routeDir, 'index.html');
  fs.writeFileSync(routeHtml, routeHtmlContent);
  
  console.log(`Created: ${route}/index.html`);
});

// Ensure .nojekyll file exists in dist (for GitHub Pages)
const nojekyllSource = path.join(__dirname, '..', 'public', '.nojekyll');
const nojekyllDest = path.join(distDir, '.nojekyll');
if (fs.existsSync(nojekyllSource)) {
  fs.copyFileSync(nojekyllSource, nojekyllDest);
  console.log('✅ .nojekyll file copied to dist');
} else if (!fs.existsSync(nojekyllDest)) {
  // Create .nojekyll if it doesn't exist
  fs.writeFileSync(nojekyllDest, '');
  console.log('✅ .nojekyll file created in dist');
}

// Clean up .ts files from dist/assets to prevent MIME type issues on GitHub Pages
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  let removedCount = 0;
  files.forEach(file => {
    if (file.endsWith('.ts')) {
      const filePath = path.join(assetsDir, file);
      fs.unlinkSync(filePath);
      removedCount++;
      console.log(`🗑️  Removed .ts file: ${file}`);
    }
  });
  if (removedCount > 0) {
    console.log(`✅ Cleaned up ${removedCount} .ts file(s) from dist/assets`);
  }
}

console.log(`✅ Static routes generated successfully (${routes.length} routes)`);

