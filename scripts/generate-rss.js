#!/usr/bin/env node
/**
 * Generate RSS feed from blog posts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const siteUrl = 'https://rosettascript.github.io';
const siteName = 'RosettaScript';
const siteDescription = 'Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation.';
const authorEmail = 'rosettascript@gmail.com';

function extractDataFromTs(filePath, dataType) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const posts = [];
  const regex = /{\s*id:\s*["']([^"']+)["'][^}]*title:\s*["']([^"']+)["'][^}]*excerpt:\s*["']([^"']+)["'][^}]*date:\s*["']([^"']+)["']/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    posts.push({
      id: match[1],
      title: match[2],
      excerpt: match[3],
      date: match[4]
    });
  }
  
  return posts;
}

function extractNewsFromTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const articles = [];
  const regex = /{\s*slug:\s*["']([^"']+)["'][^}]*title:\s*["']([^"']+)["'][^}]*excerpt:\s*["']([^"']+)["'][^}]*date:\s*["']([^"']+)["']/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    articles.push({
      slug: match[1],
      title: match[2],
      excerpt: match[3],
      date: match[4]
    });
  }
  
  return articles;
}

function generateRss() {
  const blogPostsFile = path.join(__dirname, '..', 'src', 'data', 'blogPosts.ts');
  const newsFile = path.join(__dirname, '..', 'src', 'data', 'news.ts');
  
  const blogPosts = extractDataFromTs(blogPostsFile, 'blog');
  const newsArticles = extractNewsFromTs(newsFile);
  
  const allItems = [...blogPosts, ...newsArticles]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let itemsXml = '';
  
  // Blog items
  for (const post of blogPosts) {
    const url = `${siteUrl}/blogs/${post.id}`;
    const pubDate = new Date(post.date).toUTCString();
    
    itemsXml += `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>${authorEmail}</author>
      <category>Blog</category>
    </item>
`;
  }
  
  // News items
  for (const article of newsArticles) {
    const url = `${siteUrl}/news/${article.slug}`;
    const pubDate = new Date(article.date).toUTCString();
    
    itemsXml += `    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${article.excerpt}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>${authorEmail}</author>
      <category>News</category>
    </item>\n`;
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}</link>
    <description>${siteDescription}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <managingEditor>${authorEmail}</managingEditor>
    <webMaster>${authorEmail}</webMaster>
    <copyright>${new Date().getFullYear()} ${siteName}</copyright>
${itemsXml}
  </channel>
</rss>`;

  const distPath = path.join(__dirname, '..', 'dist', 'rss.xml');
  fs.writeFileSync(distPath, rss);
  console.log('✅ RSS feed generated:', distPath);
}

generateRss();
