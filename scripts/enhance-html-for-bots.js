#!/usr/bin/env node
/**
 * Enhanced HTML generation with meta tags, structured data, and pre-rendered content
 * for better AI bot and training crawler accessibility
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogPostsFile = path.join(__dirname, '..', 'src', 'data', 'blogPosts.ts');
const newsFile = path.join(__dirname, '..', 'src', 'data', 'news.ts');
const toolsFile = path.join(__dirname, '..', 'src', 'pages', 'Tools.tsx');
const baseUrl = 'https://anivaryam.github.io';

/**
 * Extract blog post data from blogPosts.ts
 */
function getBlogPosts() {
  try {
    const content = fs.readFileSync(blogPostsFile, 'utf-8');
    const posts = [];
    
    // Find all id patterns and extract nearby fields
    const idPattern = /id:\s*"([^"]+)"/g;
    let idMatch;
    
    while ((idMatch = idPattern.exec(content)) !== null) {
      const postId = idMatch[1];
      const searchStart = Math.max(0, idMatch.index - 500);
      const searchEnd = Math.min(content.length, idMatch.index + 50000); // Increased to capture full content
      const block = content.substring(searchStart, searchEnd);
      
      const titleMatch = block.match(/title:\s*"([^"]+)"/);
      const excerptMatch = block.match(/excerpt:\s*"([^"]+)"/);
      const dateMatch = block.match(/date:\s*"([^"]+)"/);
      const imageMatch = block.match(/image:\s*"([^"]+)"/);
      const authorMatch = block.match(/author:\s*"([^"]+)"/);
      const tagsMatch = block.match(/tags:\s*\[([^\]]*)\]/);
      // Extract first paragraph of content (before first ##)
      const contentMatch = block.match(/content:\s*`([^`]+)/);
      let firstParagraph = '';
      if (contentMatch) {
        const contentText = contentMatch[1];
        // Get text before first ## or first newline after first sentence
        const firstSection = contentText.split('##')[0].trim();
        // Get first 2-3 sentences (roughly 400 chars)
        firstParagraph = firstSection.substring(0, 500).replace(/\n/g, ' ').trim();
        // Cut at last sentence end
        const lastPeriod = Math.max(
          firstParagraph.lastIndexOf('. '),
          firstParagraph.lastIndexOf('.\n')
        );
        if (lastPeriod > 100) {
          firstParagraph = firstParagraph.substring(0, lastPeriod + 1);
        }
      }
      
      if (titleMatch && excerptMatch && dateMatch) {
        const tags = tagsMatch 
          ? tagsMatch[1]
              .split(',')
              .map(tag => tag.trim().replace(/"/g, ''))
              .filter(tag => tag)
          : [];
        
        posts.push({
          id: postId,
          title: titleMatch[1],
          excerpt: excerptMatch[1],
          date: dateMatch[1],
          image: imageMatch ? imageMatch[1] : '/og-image.png',
          author: authorMatch ? authorMatch[1] : 'Anivaryam',
          tags: tags,
          firstParagraph: firstParagraph || excerptMatch[1],
          content: contentMatch ? contentMatch[1] : ''
        });
      }
    }
    
    return posts;
  } catch (error) {
    console.warn('Warning: Could not read blogPosts.ts:', error.message);
    return [];
  }
}

/**
 * Extract news article data from news.ts
 */
function getNewsArticles() {
  try {
    const content = fs.readFileSync(newsFile, 'utf-8');
    const articles = [];
    
    // Find all slug patterns and extract nearby fields
    const slugPattern = /slug:\s*"([^"]+)"/g;
    let slugMatch;
    
    while ((slugMatch = slugPattern.exec(content)) !== null) {
      const articleSlug = slugMatch[1];
      const searchStart = Math.max(0, slugMatch.index - 500);
      const searchEnd = Math.min(content.length, slugMatch.index + 5000);
      const block = content.substring(searchStart, searchEnd);
      
      const idMatch = block.match(/id:\s*"([^"]+)"/);
      const titleMatch = block.match(/title:\s*"([^"]+)"/);
      const excerptMatch = block.match(/excerpt:\s*"([^"]+)"/);
      const dateMatch = block.match(/date:\s*"([^"]+)"/);
      const imageMatch = block.match(/image:\s*"([^"]+)"/);
      const categoryMatch = block.match(/category:\s*"([^"]+)"/);
      const authorMatch = block.match(/author:\s*"([^"]+)"/);
      const tagsMatch = block.match(/tags:\s*\[([^\]]*)\]/);
      
      if (titleMatch && excerptMatch && dateMatch) {
        const tags = tagsMatch 
          ? tagsMatch[1]
              .split(',')
              .map(tag => tag.trim().replace(/"/g, ''))
              .filter(tag => tag)
          : [];
        
        articles.push({
          id: idMatch ? idMatch[1] : articleSlug,
          slug: articleSlug,
          title: titleMatch[1],
          excerpt: excerptMatch[1],
          date: dateMatch[1],
          image: imageMatch ? imageMatch[1] : '/og-image.png',
          category: categoryMatch ? categoryMatch[1] : 'Updates',
          author: authorMatch ? authorMatch[1] : 'Anivaryam',
          tags: tags
        });
      }
    }
    
    return articles;
  } catch (error) {
    console.warn('Warning: Could not read news.ts:', error.message);
    return [];
  }
}

/**
 * Extract tool metadata from individual tool page components
 * This ensures static HTML matches what React components render
 */
function getToolsMetadata() {
  try {
    const toolsDir = path.join(__dirname, '..', 'src', 'pages', 'tools');
    const tools = [];
    
    // Map of tool IDs to their component file names
    const toolFileMap = {
      'word-to-html': 'WordToHtml.tsx',
      'json-formatter': 'JsonFormatter.tsx',
      'base64': 'Base64.tsx',
      'url-encoder': 'UrlEncoder.tsx',
      'color-converter': 'ColorConverter.tsx',
      'uuid-generator': 'UuidGenerator.tsx',
      'regex-tester': 'RegexTester.tsx',
      'hash-generator': 'HashGenerator.tsx',
      'hash-decoder': 'HashDecoder.tsx',
      'jwt-decoder': 'JwtDecoder.tsx',
      'jwt-encoder': 'JwtEncoder.tsx',
      'timestamp-converter': 'TimestampConverter.tsx',
      'web-scraper': 'WebScraper.tsx',
      'json-extractor': 'JsonExtractor.tsx',
      'qr-code-generator': 'QrCodeGenerator.tsx',
      'text-diff': 'TextDiff.tsx',
      'csv-to-json': 'CsvToJson.tsx',
      'image-tool': 'ImageTool.tsx',
      'random-universe-cipher': 'RandomUniverseCipher.tsx',
      'listicle-template': 'ListicleTemplate.tsx'
    };
    
    // Read Tools.tsx to get paths
    const toolsContent = fs.readFileSync(toolsFile, 'utf-8');
    const toolsArrayMatch = toolsContent.match(/const tools\s*=\s*\[([\s\S]*?)\];/);
    if (!toolsArrayMatch) return [];
    
    const toolsArrayContent = toolsArrayMatch[1];
    
    // Extract path mappings from Tools.tsx - match id and path in same object
    const pathMap = new Map();
    const idPattern = /id:\s*"([^"]+)"/g;
    let idMatch;
    
    while ((idMatch = idPattern.exec(toolsArrayContent)) !== null) {
      const toolId = idMatch[1];
      const idIndex = idMatch.index;
      
      // Find the object boundaries for this tool
      let objectStart = idIndex;
      while (objectStart > 0 && toolsArrayContent[objectStart] !== '{') {
        objectStart--;
      }
      
      // Find the end of this object
      let objectEnd = idIndex;
      let braceCount = 0;
      let foundOpening = false;
      
      while (objectEnd < toolsArrayContent.length) {
        const char = toolsArrayContent[objectEnd];
        if (char === '{') {
          braceCount++;
          foundOpening = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpening && braceCount === 0) {
            break;
          }
        }
        objectEnd++;
      }
      
      // Extract the tool object block
      const toolBlock = toolsArrayContent.substring(objectStart, objectEnd + 1);
      const pathMatch = toolBlock.match(/path:\s*"([^"]+)"/);
      
      if (pathMatch) {
        pathMap.set(toolId, pathMatch[1]);
      }
    }
    
    // Read each tool component file to extract SEO metadata
    for (const [toolId, componentFile] of Object.entries(toolFileMap)) {
      const componentPath = path.join(toolsDir, componentFile);
      
      if (!fs.existsSync(componentPath)) {
        console.warn(`Warning: Tool component not found: ${componentFile}`);
        continue;
      }
      
      const componentContent = fs.readFileSync(componentPath, 'utf-8');
      
      // Extract SEO props - look for <SEO component with title and description
      const seoMatch = componentContent.match(/<SEO\s+([\s\S]*?)\/>/);
      if (!seoMatch) {
        console.warn(`Warning: No SEO component found in ${componentFile}`);
        continue;
      }
      
      const seoProps = seoMatch[1];
      const titleMatch = seoProps.match(/title=["']([^"']+)["']/);
      const descriptionMatch = seoProps.match(/description=["']([^"']+)["']/);
      
      if (titleMatch && descriptionMatch) {
        const toolPath = pathMap.get(toolId) || `/tools/${toolId}`;
        tools.push({
          id: toolId,
          title: titleMatch[1],
          description: descriptionMatch[1],
          path: toolPath
        });
      } else {
        console.warn(`Warning: Could not extract title/description from ${componentFile}`);
      }
    }
    
    return tools;
  } catch (error) {
    console.warn('Warning: Could not read tool components:', error.message);
    return [];
  }
}

/**
 * Extract YouTube video IDs from blog content
 */
function extractYouTubeVideos(content) {
  if (!content) return [];
  
  const videoIds = [];
  
  // Match standalone YouTube URLs
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/g,
  ];
  
  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (!videoIds.includes(match[1])) {
        videoIds.push(match[1]);
      }
    }
  }
  
  return videoIds;
}

/**
 * Generate JSON-LD structured data for a blog post
 */
function generateBlogPostStructuredData(post) {
  const videoIds = extractYouTubeVideos(post.content || '');
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": {
      "@type": "Organization",
      "name": post.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Anivaryam",
      "url": baseUrl
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${baseUrl}/blogs/${post.id}`
    },
    "keywords": post.tags ? post.tags.join(", ") : ""
  };
  
  // Add video if found
  if (videoIds.length > 0) {
    // Format date with timezone (ISO 8601)
    const uploadDate = post.date && /^\d{4}-\d{2}-\d{2}$/.test(post.date) 
      ? post.date + 'T00:00:00+00:00' 
      : new Date().toISOString();
    
    structuredData.video = {
      "@type": "VideoObject",
      "name": post.title,
      "description": post.excerpt,
      "thumbnailUrl": `https://img.youtube.com/vi/${videoIds[0]}/maxresdefault.jpg`,
      "uploadDate": uploadDate,
      "contentUrl": `https://www.youtube.com/watch?v=${videoIds[0]}`,
      "embedUrl": `https://www.youtube.com/embed/${videoIds[0]}`
    };
  }
  
  return structuredData;
}

/**
 * Generate JSON-LD structured data for a news article
 */
function generateNewsArticleStructuredData(article) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.excerpt,
    "datePublished": article.date,
    "dateModified": article.date, // Use published date as modified date if not available
    "articleSection": article.category,
    "author": {
      "@type": "Organization",
      "name": article.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Anivaryam",
      "url": baseUrl
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${baseUrl}/news/${article.slug}`
    },
    "keywords": article.tags.join(", ")
  };
}

/**
 * Generate JSON-LD structured data for a tool page
 */
function generateToolStructuredData(tool) {
  const today = new Date().toISOString().split('T')[0];
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.title,
    "description": tool.description,
    "url": `${baseUrl}${tool.path}`,
    "datePublished": today,
    "dateModified": today,
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "provider": {
      "@type": "Organization",
      "name": "Anivaryam",
      "url": baseUrl
    }
  };
}

/**
 * Generate JSON-LD structured data for main pages
 */
function generatePageStructuredData(route, metadata) {
  const today = new Date().toISOString().split('T')[0];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": metadata.title,
    "description": metadata.description,
    "url": `${baseUrl}${route}`,
    "datePublished": today,
    "dateModified": today,
    "isPartOf": {
      "@type": "WebSite",
      "name": "Anivaryam",
      "url": baseUrl
    }
  };
}

/**
 * Truncate title to 60 characters (Google's recommended max)
 */
function truncateTitle(text, maxLength = 60) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Truncate description to 155 characters (Google's recommended max)
 */
function truncateDescription(text, maxLength = 155) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Inject meta tags and structured data into HTML
 */
function injectMetaTags(html, metadata, route, structuredData = null) {
  const siteName = "Anivaryam";
  
  // Truncate description first
  const truncatedDescription = truncateDescription(metadata.description, 155);
  
  // Build title with same logic as SEO component
  // Main pages that should NOT have brand appended (use keyword-rich titles)
  const mainPagesWithoutBrand = [
    "Home",
    "Free Developer Tools - Conversion & Formatting",
    "Free Online Developer Tools - 20+ Tools"
  ];
  
  let fullTitle;
  if (mainPagesWithoutBrand.includes(metadata.title)) {
    fullTitle = truncateTitle(metadata.title, 60);
  } else {
    // Reserve space for " | Anivaryam" (16 chars), so max 44 chars for title
    const maxTitleLength = 44;
    const truncatedBaseTitle = truncateTitle(metadata.title, maxTitleLength);
    fullTitle = `${truncatedBaseTitle} | ${siteName}`;
    // Final safety check - ensure total is under 60
    fullTitle = truncateTitle(fullTitle, 60);
  }
  
  // Escape HTML in metadata
  const escapeHtml = (str) => str.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
  
  // Create canonical URL - no trailing slash to match React Router links
  const canonicalUrl = `${baseUrl}${route}`;
  
  // Remove any existing meta tags and canonical link to avoid duplicates
  // Also remove title tag to ensure it gets replaced
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+property=["']og:image["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '');
  html = html.replace(/<meta\s+name=["']twitter:image["'][^>]*>/gi, '');
  html = html.replace(/<title>[^<]*<\/title>/gi, ''); // Remove title tag - will be added back
  
  // Create meta tags HTML (use truncated values) - include title tag
  // Check if image is external URL (starts with http/https) or local path
  const isExternalImage = metadata.ogImage && (metadata.ogImage.startsWith('http://') || metadata.ogImage.startsWith('https://'));
  const ogImageUrl = isExternalImage ? metadata.ogImage : (metadata.ogImage ? `${baseUrl}${metadata.ogImage}` : '');
  const ogImageTag = ogImageUrl ? `<meta property="og:image" content="${ogImageUrl}" />` : '';
  const twitterImageTag = ogImageUrl ? `<meta name="twitter:image" content="${ogImageUrl}" />` : '';
  const metaTags = `
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(truncatedDescription)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(truncatedDescription)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    ${ogImageTag}
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(truncatedDescription)}" />
    ${twitterImageTag}
  `;
  
  // Update or add meta tags after the viewport tag (includes title)
  html = html.replace(
    /(<meta name="viewport"[^>]*>)/,
    `$1${metaTags}`
  );

  // Remove Dublin Core metadata for all pages except homepage
  // Dublin Core is only for homepage/organization
  if (route !== '/') {
    // Remove Dublin Core section entirely
    const dcRegex = /<!--\s*Dublin Core Metadata\s*-->[\s\S]*?<!--\s*Open\s+Graph\s*-->/gi;
    html = html.replace(dcRegex, '<!-- Open Graph -->');
  }
  
  // Ensure title tag exists (in case viewport replacement didn't work)
  if (!html.includes(`<title>${escapeHtml(fullTitle)}</title>`)) {
    // Try to find charset tag and add title after it
    html = html.replace(
      /(<meta charset="[^"]*"[^>]*>)/i,
      `$1\n    <title>${escapeHtml(fullTitle)}</title>`
    );
  }
  
  // Add JSON-LD structured data before closing head tag
  if (structuredData) {
    const jsonLd = `
    <script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
    </script>
    `;
    html = html.replace('</head>', `${jsonLd}</head>`);
  }
  
  return html;
}

/**
 * Pre-render blog post content for bots
 */
function preRenderBlogPostContent(post) {
  const escapeHtml = (str) => str ? str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  const firstParagraph = post.firstParagraph || post.excerpt || '';
  const hasContent = firstParagraph && firstParagraph.length > 100;
  
  return `
    <noscript>
      <article style="padding: 2rem; max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; line-height: 1.8;">
        <header style="margin-bottom: 2rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #111827;">${escapeHtml(post.title)}</h1>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">
            <span>Author: ${escapeHtml(post.author || 'Anivaryam')}</span>
            <span>Published: ${new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            ${post.tags && post.tags.length > 0 ? `<span>Tags: ${post.tags.join(', ')}</span>` : ''}
          </div>
        </header>
        <div style="font-size: 1.125rem; color: #374151; margin-bottom: 2rem;">
          <p style="font-weight: 500; margin-bottom: 1rem; font-size: 1.25rem;">${escapeHtml(post.excerpt)}</p>
          ${hasContent ? `<div style="margin-top: 1.5rem; padding: 1.5rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #22c55e;">
            <p style="color: #374151; line-height: 1.8; margin-bottom: 1rem;">${escapeHtml(firstParagraph)}</p>
          </div>` : ''}
          <p style="color: #6b7280; margin-top: 1.5rem;">This article contains detailed information about ${escapeHtml(post.title.toLowerCase())}. Please enable JavaScript to view the full article content with code examples, images, and interactive elements.</p>
        </div>
        <nav style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <a href="/blogs" style="color: #22c55e; text-decoration: none;">← Back to Blog</a> | 
          <a href="/" style="color: #22c55e; text-decoration: none;">Home</a>
        </nav>
      </article>
    </noscript>
  `;
}

/**
 * Extract intro paragraphs from tool component file
 */
function extractToolIntroParagraphs(toolId) {
  try {
    const toolFileMap = {
      'word-to-html': 'WordToHtml.tsx',
      'json-formatter': 'JsonFormatter.tsx',
      'base64': 'Base64.tsx',
      'url-encoder': 'UrlEncoder.tsx',
      'color-converter': 'ColorConverter.tsx',
      'uuid-generator': 'UuidGenerator.tsx',
      'regex-tester': 'RegexTester.tsx',
      'hash-generator': 'HashGenerator.tsx',
      'hash-decoder': 'HashDecoder.tsx',
      'jwt-decoder': 'JwtDecoder.tsx',
      'jwt-encoder': 'JwtEncoder.tsx',
      'timestamp-converter': 'TimestampConverter.tsx',
      'web-scraper': 'WebScraper.tsx',
      'json-extractor': 'JsonExtractor.tsx',
      'qr-code-generator': 'QrCodeGenerator.tsx',
      'text-diff': 'TextDiff.tsx',
      'csv-to-json': 'CsvToJson.tsx',
      'image-tool': 'ImageTool.tsx',
      'random-universe-cipher': 'RandomUniverseCipher.tsx',
      'listicle-template': 'ListicleTemplate.tsx'
    };
    
    const componentFile = toolFileMap[toolId];
    if (!componentFile) return '';
    
    const toolsDir = path.join(__dirname, '..', 'src', 'pages', 'tools');
    const componentPath = path.join(toolsDir, componentFile);
    
    if (!fs.existsSync(componentPath)) return '';
    
    const componentContent = fs.readFileSync(componentPath, 'utf-8');
    
    // Extract paragraphs from the header section (between h1 and the tool component)
    // Look for <p className="text-muted-foreground"> patterns
    const paragraphMatches = componentContent.matchAll(/<p className="text-muted-foreground[^"]*">([^<]+)<\/p>/g);
    const paragraphs = Array.from(paragraphMatches, match => match[1].trim()).filter(p => p.length > 50);
    
    return paragraphs.slice(0, 2).join(' '); // Get first 2 paragraphs
  } catch (error) {
    return '';
  }
}

/**
 * Pre-render tool content for bots
 */
function preRenderToolContent(tool) {
  const escapeHtml = (str) => str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Extract intro paragraphs from the tool component
  const introText = extractToolIntroParagraphs(tool.id);
  const hasIntro = introText && introText.length > 50;
  
  return `
    <noscript>
      <main style="padding: 2rem; max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; line-height: 1.8;">
        <header style="margin-bottom: 2rem;">
          <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #111827;">${escapeHtml(tool.title)}</h1>
          <p style="font-size: 1.125rem; color: #374151; margin-bottom: 1rem;">${escapeHtml(tool.description)}</p>
          ${hasIntro ? `<div style="margin-top: 1.5rem; padding: 1.5rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #22c55e;">
            <p style="color: #374151; margin-bottom: 1rem; line-height: 1.7;">${escapeHtml(introText)}</p>
          </div>` : ''}
        </header>
        <div style="background: #f3f4f6; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
          <p style="color: #6b7280; margin: 0;">This is an interactive tool. Please enable JavaScript to use ${escapeHtml(tool.title.toLowerCase())}.</p>
        </div>
        <section style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
          <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">About This Tool</h2>
          <p style="color: #6b7280; margin-bottom: 1rem;">
            ${escapeHtml(tool.title)} is a free online developer tool that runs entirely in your browser. No signup required, no data uploaded to servers—complete privacy and security for your content.
          </p>
          <p style="color: #6b7280; margin-bottom: 1rem;">
            Perfect for developers, content editors, technical writers, and anyone who needs to ${escapeHtml(tool.description.toLowerCase())}. All processing happens locally in your browser, ensuring your data never leaves your device.
          </p>
        </section>
        <nav style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <a href="/tools" style="color: #22c55e; text-decoration: none;">← Back to Tools</a> | 
          <a href="/" style="color: #22c55e; text-decoration: none;">Home</a>
        </nav>
      </main>
    </noscript>
  `;
}

/**
 * Pre-render news article content for bots
 */
function preRenderNewsArticleContent(article) {
  const escapeHtml = (str) => str ? str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  const firstParagraph = article.firstParagraph || article.excerpt || '';
  const hasContent = firstParagraph && firstParagraph.length > 100;
  
  return `
    <noscript>
      <article style="padding: 2rem; max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; line-height: 1.8;">
        <header style="margin-bottom: 2rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #111827;">${escapeHtml(article.title)}</h1>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">
            <span>Category: ${escapeHtml(article.category || 'Updates')}</span>
            <span>Published: ${new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            ${article.tags && article.tags.length > 0 ? `<span>Tags: ${article.tags.join(', ')}</span>` : ''}
          </div>
        </header>
        <div style="font-size: 1.125rem; color: #374151; margin-bottom: 2rem;">
          <p style="font-weight: 500; margin-bottom: 1rem; font-size: 1.25rem;">${escapeHtml(article.excerpt)}</p>
          ${hasContent ? `<div style="margin-top: 1.5rem; padding: 1.5rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #22c55e;">
            <p style="color: #374151; line-height: 1.8; margin-bottom: 1rem;">${escapeHtml(firstParagraph)}</p>
          </div>` : ''}
          <p style="color: #6b7280; margin-top: 1.5rem;">This news article contains detailed information about ${escapeHtml(article.title.toLowerCase())}. Please enable JavaScript to view the full article content with images, code examples, and interactive elements.</p>
        </div>
        <nav style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <a href="/news" style="color: #22c55e; text-decoration: none;">← Back to News</a> | 
          <a href="/" style="color: #22c55e; text-decoration: none;">Home</a>
        </nav>
      </article>
    </noscript>
  `;
}

/**
 * Pre-render homepage content for bots and search engines
 */
function preRenderHomepageContent(metadata) {
  const escapeHtml = (str) => str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <noscript>
      <main style="padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; line-height: 1.8;">
        <header style="margin-bottom: 3rem; text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #111827;">Free Online Developer Tools for Text, Code & Document Conversion</h1>
          <p style="font-size: 1.125rem; color: #374151; margin-bottom: 1rem; max-width: 800px; margin-left: auto; margin-right: auto;">
            Anivaryam offers 20+ free online developer tools for converting, cleaning, formatting, and automating text and code. Whether you need a <a href="/tools/word-to-html" style="color: #22c55e; text-decoration: none;">Word to HTML converter</a>, <a href="/tools/json-formatter" style="color: #22c55e; text-decoration: none;">JSON formatter</a>, <a href="/tools/base64" style="color: #22c55e; text-decoration: none;">Base64 encoder</a>, or more, these tools run entirely in your browser without signup or cost. These tools help developers, content editors, and technical writers save time while maintaining quality.
          </p>
        </header>

        <section style="margin-bottom: 3rem;">
          <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color: #111827; text-align: center;">Popular Online Developer Tools</h2>
          <p style="color: #6b7280; margin-bottom: 2rem; text-align: center; max-width: 700px; margin-left: auto; margin-right: auto;">
            My collection of free developer tools covers everything from document conversion to code formatting. Each tool runs entirely in your browser—no server uploads, no data storage, complete privacy.
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/word-to-html" style="color: inherit; text-decoration: none;">Word to HTML Converter</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Clean up Word-generated HTML and convert documents to semantic, SEO-friendly HTML code.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/json-formatter" style="color: inherit; text-decoration: none;">JSON Formatter & Validator</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Format, validate, and beautify JSON data with syntax highlighting and error detection.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/base64" style="color: inherit; text-decoration: none;">Base64 Encode/Decode</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Encode images or text to Base64, or decode Base64 strings back to readable format.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/hash-generator" style="color: inherit; text-decoration: none;">Hash Generator</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes for passwords and data integrity.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/regex-tester" style="color: inherit; text-decoration: none;">Regex Tester</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Test and debug regular expressions with live matching and capture group extraction.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/web-scraper" style="color: inherit; text-decoration: none;">Web Scraper</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Extract data from websites using CSS selectors. Free, fast, and runs in your browser.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/json-extractor" style="color: inherit; text-decoration: none;">JSON Data Extractor</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Extract specific fields from JSON structures using path syntax or field names.</p>
            </div>
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;"><a href="/tools/text-diff" style="color: inherit; text-decoration: none;">Text Cleanup & Case Converter</a></h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Normalize text, convert cases, and clean up formatting issues in your content.</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 2rem;">
            <a href="/tools" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Explore All Free Developer Tools →</a>
          </div>
        </section>

        <section style="margin-bottom: 3rem; background: #f9fafb; padding: 2rem; border-radius: 8px;">
          <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color: #111827; text-align: center;">Why Use Anivaryam Developer Tools</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">No Signup Required</h3>
              <p style="color: #6b7280; margin: 0;">All my developer tools are completely free and require no account creation. Start using any tool instantly—no email, no passwords, no barriers.</p>
            </div>
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Runs Locally in Browser</h3>
              <p style="color: #6b7280; margin: 0;">Every tool processes data entirely in your browser. Your content never leaves your device, ensuring complete privacy and security for sensitive documents and code.</p>
            </div>
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Privacy-Focused</h3>
              <p style="color: #6b7280; margin: 0;">I don't store, track, or analyze your data. All processing happens client-side, making these tools perfect for handling confidential information and proprietary code.</p>
            </div>
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; color: #111827;">Open Source</h3>
              <p style="color: #6b7280; margin: 0;">Anivaryam is an open-source project built by a developer, for developers. You can review the code, contribute improvements, or use it as a reference for your own projects.</p>
            </div>
          </div>
        </section>

        <section style="margin-bottom: 3rem;">
          <h2 style="font-size: 2rem; margin-bottom: 1.5rem; color: #111827; text-align: center;">Who These Tools Are For</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; text-align: center;">
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Web Developers</h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Format JSON, encode data, generate UUIDs, test regex patterns, and convert between formats quickly.</p>
            </div>
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Content Editors</h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Convert Word documents to clean HTML, format text, and prepare content for web publishing.</p>
            </div>
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Technical Writers</h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Clean up HTML from documentation tools, format code snippets, and ensure consistent formatting.</p>
            </div>
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">SEO Specialists</h3>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Generate clean HTML code, test regex patterns, and extract data from websites for SEO analysis.</p>
            </div>
          </div>
        </section>

        <nav style="margin-top: 3rem; padding-top: 2rem; border-top: 2px solid #e5e7eb; text-align: center;">
          <p style="color: #6b7280; margin-bottom: 1rem;">Please enable JavaScript to access the full content and interactive features.</p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="/tools" style="color: #22c55e; text-decoration: none;">Browse Tools</a> |
            <a href="/blogs" style="color: #22c55e; text-decoration: none;">Read Blog</a> |
            <a href="/downloads" style="color: #22c55e; text-decoration: none;">Downloads</a> |
            <a href="/about" style="color: #22c55e; text-decoration: none;">About</a>
          </div>
        </nav>
      </main>
    </noscript>
  `;
}

/**
 * Pre-render main page content (tools, blogs, etc.) for bots
 */
function preRenderMainPageContent(route, metadata) {
  const escapeHtml = (str) => str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  let content = '';
  
  if (route === '/tools') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Browse My Complete Collection</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Browse my complete collection of 20+ free online developer tools designed to streamline your workflow. From document conversion and code formatting to data encoding and web scraping—find the perfect tool for your needs.
        </p>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          All tools run entirely in your browser with no signup required. Your data stays private, processing happens locally, and everything is completely free. Perfect for web developers, content editors, technical writers, and SEO specialists.
        </p>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="/tools" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View All Tools →</a>
        </div>
      </section>
    `;
  } else if (route === '/blogs') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Tutorials, Tips & Resources</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Learn how to use these tools effectively and discover best practices for development, automation, and more. My blog covers topics like web scraping, HTML conversion, database management, and Windows automation.
          </p>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Explore my collection of tutorials, tips, and developer resources. Whether you're learning about web scraping techniques, understanding HTML conversion best practices, or exploring cryptography and post-quantum security, my blog has something for every developer.
        </p>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="/blogs" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Read Blog Posts →</a>
        </div>
      </section>
    `;
  } else if (route === '/news') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Latest Updates & Announcements</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Stay informed about new tools, bug fixes, improvements, and feature highlights from Anivaryam. Get notified about updates and enhancements to my developer tools.
        </p>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          My news section keeps you up-to-date with the latest developments, new tool releases, performance improvements, and important announcements. Follow along to see how Anivaryam evolves to better serve the developer community.
        </p>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="/news" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View All News →</a>
        </div>
      </section>
    `;
  } else if (route === '/downloads') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Free Developer Scripts & Utilities</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Download powerful automation scripts and utilities for Windows, PERN stack setup, and more. All scripts are free, open-source, and ready to use.
        </p>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          My downloadable tools include Microsoft Script for Windows automation, PostgreSQL Manager for database management, and other developer utilities. Each script comes with documentation and examples to help you get started quickly.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Microsoft Script</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Powerful automation scripts for Windows machines. Automate repetitive tasks and streamline your workflow.</p>
          </div>
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">PostgreSQL Manager</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Database management utilities for PERN stack development. Simplify your database operations.</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="/downloads" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Browse Downloads →</a>
        </div>
      </section>
    `;
  } else if (route === '/about') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Developer Tools Made Simple</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Anivaryam was born from a simple idea: developers shouldn't waste time on repetitive tasks. I build tools that let you focus on what matters—creating amazing software.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; margin-bottom: 2rem;">
          <div style="text-align: center; padding: 1.5rem; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 2rem; font-weight: bold; color: #22c55e; margin-bottom: 0.5rem;">10K+</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Downloads</div>
          </div>
          <div style="text-align: center; padding: 1.5rem; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 2rem; font-weight: bold; color: #22c55e; margin-bottom: 0.5rem;">19+</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Tools & Scripts</div>
          </div>
          <div style="text-align: center; padding: 1.5rem; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 2rem; font-weight: bold; color: #22c55e; margin-bottom: 0.5rem;">5K+</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Happy Developers</div>
          </div>
          <div style="text-align: center; padding: 1.5rem; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 2rem; font-weight: bold; color: #22c55e; margin-bottom: 0.5rem;">100%</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Free to Use</div>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 2rem; border-radius: 8px; margin-top: 2rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #111827;">My Values</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <div>
              <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Simplicity</h4>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Developer tools should be simple and intuitive. No steep learning curves, just solutions that work.</p>
            </div>
            <div>
              <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Efficiency</h4>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Every tool is designed to save you time. Focus on building, not configuring.</p>
            </div>
            <div>
              <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Community</h4>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Built by a developer, for developers. All tools are free to use and many are open source.</p>
            </div>
          </div>
        </div>
      </section>
    `;
  } else if (route === '/school-projects') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Ready-to-Use Project Templates</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Access free educational project templates for students. These projects include source code, documentation, and are perfect for learning and academic use.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Logic Gates Calculator</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;">4-bit calculator implementation using logic gates in Proteus. Available in two versions: with memory and without memory.</p>
            <p style="color: #9ca3af; font-size: 0.85rem; margin: 0;">Category: Electronics | Difficulty: Intermediate</p>
          </div>
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Audio Bandpass Filter</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;">Matlab implementation of an audio bandpass filter for signal processing applications.</p>
            <p style="color: #9ca3af; font-size: 0.85rem; margin: 0;">Category: Signal Processing | Difficulty: Intermediate</p>
          </div>
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Copy Paste Listener</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;">Windows utility tool built with Python that monitors clipboard activity.</p>
            <p style="color: #9ca3af; font-size: 0.85rem; margin: 0;">Category: Utility | Difficulty: Beginner</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
          <a href="/school-projects" style="display: inline-block; padding: 0.75rem 1.5rem; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View All Projects →</a>
        </div>
      </section>
    `;
  } else if (route === '/issues') {
    content = `
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: #111827;">Help Me Improve Anivaryam</h2>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">
          Your feedback helps me improve Anivaryam. Whether you've found a bug, have a feature request, or just want to share your thoughts, I'm here to listen.
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Report a Bug</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Found something that's not working as expected? Let me know so I can fix it.</p>
            <a href="https://github.com/anivaryam/anivaryam.github.io/issues" style="color: #22c55e; text-decoration: none; font-size: 0.9rem;">Report Bug →</a>
          </div>
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">Feature Request</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Have an idea for a new tool or feature? I'd love to hear your suggestions.</p>
            <a href="https://github.com/anivaryam/anivaryam.github.io/issues" style="color: #22c55e; text-decoration: none; font-size: 0.9rem;">Request Feature →</a>
          </div>
          <div style="padding: 1.5rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827;">General Issue</h3>
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Something else on your mind? Open a general issue to discuss.</p>
            <a href="https://github.com/anivaryam/anivaryam.github.io/issues" style="color: #22c55e; text-decoration: none; font-size: 0.9rem;">Open Issue →</a>
          </div>
        </div>
        <p style="color: #6b7280; margin-top: 2rem; text-align: center;">
          All issues are tracked on <a href="https://github.com/anivaryam/anivaryam.github.io/issues" style="color: #22c55e; text-decoration: none;">GitHub Issues</a>. I review every submission and respond as quickly as possible.
        </p>
      </section>
    `;
  } else {
    content = `<p style="color: #6b7280; margin-bottom: 1.5rem;">${escapeHtml(metadata.description)}</p>`;
  }
  
  return `
    <noscript>
      <main style="padding: 2rem; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; line-height: 1.8;">
        <header style="margin-bottom: 2rem; text-align: center;">
          <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #111827;">${escapeHtml(metadata.title)}</h1>
          ${content}
        </header>
        <nav style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #6b7280; margin-bottom: 1rem;">Please enable JavaScript to access the full content and interactive features.</p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="/" style="color: #22c55e; text-decoration: none;">Home</a> |
            <a href="/tools" style="color: #22c55e; text-decoration: none;">Tools</a> |
            <a href="/blogs" style="color: #22c55e; text-decoration: none;">Blog</a> |
            <a href="/about" style="color: #22c55e; text-decoration: none;">About</a>
          </div>
        </nav>
      </main>
    </noscript>
  `;
}

export { 
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
};
