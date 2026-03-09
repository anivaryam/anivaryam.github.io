#!/usr/bin/env node
/**
 * Generate sitemap.xml dynamically from blog posts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogPostsFile = path.join(__dirname, '..', 'src', 'data', 'blogPosts.ts');
const newsFile = path.join(__dirname, '..', 'src', 'data', 'news.ts');
const publicSitemapFile = path.join(__dirname, '..', 'public', 'sitemap.xml');
const distSitemapFile = path.join(__dirname, '..', 'dist', 'sitemap.xml');
const baseUrl = 'https://anivaryam.github.io';

/**
 * Extract blog posts with IDs and dates from blogPosts.ts
 */
function getBlogPosts() {
  try {
    const content = fs.readFileSync(blogPostsFile, 'utf-8');
    const posts = [];
    
    // Match each blog post object more accurately
    // Look for id: "..." followed by date: "..." within the same object
    const postPattern = /\{\s*id:\s*"([^"]+)"[\s\S]*?date:\s*"([^"]+)"/g;
    let match;
    
    while ((match = postPattern.exec(content)) !== null) {
      posts.push({
        id: match[1],
        date: match[2]
      });
    }
    
    return posts;
  } catch (error) {
    console.warn('Warning: Could not read blogPosts.ts:', error.message);
    return [];
  }
}

/**
 * Extract news articles with slugs and dates from news.ts
 */
function getNewsArticles() {
  try {
    const content = fs.readFileSync(newsFile, 'utf-8');
    const articles = [];
    
    // Match each news article object - look for id: "..." or slug: "..." followed by date: "..." within the same object
    // Similar to blog posts pattern but for news articles
    const articlePattern = /\{\s*(?:id|slug):\s*"([^"]+)"[\s\S]*?date:\s*"([^"]+)"/g;
    let match;
    
    while ((match = articlePattern.exec(content)) !== null) {
      // Also try to find slug separately if id was matched
      const blockStart = Math.max(0, match.index - 100);
      const blockEnd = Math.min(content.length, match.index + 2000);
      const block = content.substring(blockStart, blockEnd);
      
      // Try to find slug in the block
      const slugMatch = block.match(/slug:\s*"([^"]+)"/);
      const slug = slugMatch ? slugMatch[1] : match[1]; // Use slug if found, otherwise use id
      
      articles.push({
        slug: slug,
        date: match[2]
      });
    }
    
    return articles;
  } catch (error) {
    console.warn('Warning: Could not read news.ts:', error.message);
    return [];
  }
}

/**
 * Format date for sitemap (YYYY-MM-DD)
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

const blogPosts = getBlogPosts();
const newsArticles = getNewsArticles();
const today = new Date().toISOString().split('T')[0];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/faq</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/downloads</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/blogs</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/news</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/school-projects</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <!-- Tool Pages -->
  <url>
    <loc>${baseUrl}/tools/word-to-html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/json-formatter</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/base64</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/url-encoder</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/color-converter</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/uuid-generator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/regex-tester</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/hash-generator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/hash-decoder</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/jwt-decoder</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/timestamp-converter</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/web-scraper</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/json-extractor</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/qr-code-generator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/text-diff</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/csv-to-json</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/image-tool</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/random-universe-cipher</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>${baseUrl}/tools/listicle-template</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <!-- Blog Posts -->
${blogPosts.map(post => `  <url>
    <loc>${baseUrl}/blogs/${post.id}</loc>
    <lastmod>${formatDate(post.date)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
  
  <!-- News Articles -->
${newsArticles.map(article => `  <url>
    <loc>${baseUrl}/news/${article.slug}</loc>
    <lastmod>${formatDate(article.date)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
  
</urlset>
`;

// Write to public directory
fs.writeFileSync(publicSitemapFile, sitemap, 'utf-8');

// Write to dist directory if it exists (for deployment)
const distDir = path.dirname(distSitemapFile);
if (fs.existsSync(distDir)) {
  fs.writeFileSync(distSitemapFile, sitemap, 'utf-8');
}

console.log(`✅ Sitemap generated successfully with ${blogPosts.length} blog posts and ${newsArticles.length} news articles`);

