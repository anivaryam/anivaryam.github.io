import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  article?: {
    publishedTime?: string;
    author?: string;
    tags?: string[];
  };
  structuredData?: {
    type?: "WebSite" | "SoftwareApplication" | "Article" | "WebPage";
    applicationCategory?: string;
    operatingSystem?: string;
    offers?: {
      price: string;
      priceCurrency: string;
    };
  };
  breadcrumbs?: {
    name: string;
    url: string;
  }[];
}

export function SEO({
  title,
  description,
  canonical,
  ogImage = "/og-image.png",
  ogType = "website",
  article,
  structuredData,
  breadcrumbs,
}: SEOProps) {
  const siteName = "Anivaryam";
  
  // Truncate title to 60 characters (Google's recommended max)
  const truncateTitle = (text: string, maxLength: number = 60): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };
  
  // Truncate description to 155 characters (Google's recommended max)
  const truncateDescription = (text: string, maxLength: number = 155): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };
  
  // For homepage and main pages (like /tools), use keyword-rich title without brand
  // For other pages, append brand
  // Truncate base title first to leave room for brand (max 60 chars total)
  let fullTitle: string;
  // Main pages that should NOT have brand appended (use keyword-rich titles)
  const mainPagesWithoutBrand = [
    "Home",
    "Free Developer Tools - Conversion & Formatting",
    "Free Online Developer Tools - 20+ Tools"
  ];
  
  if (mainPagesWithoutBrand.includes(title)) {
    fullTitle = truncateTitle(title, 60);
  } else {
    // Reserve space for " | Anivaryam" (16 chars), so max 44 chars for title
    const maxTitleLength = 44;
    const truncatedBaseTitle = truncateTitle(title, maxTitleLength);
    fullTitle = `${truncatedBaseTitle} | ${siteName}`;
    // Final safety check - ensure total is under 60
    fullTitle = truncateTitle(fullTitle, 60);
  }
  
  // Truncate description
  const truncatedDescription = truncateDescription(description, 155);

  // Normalize canonical URL - no trailing slash to match static HTML and React Router links
  const normalizeCanonical = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    
    // Don't modify homepage
    if (url === "https://anivaryam.github.io" || url === "https://anivaryam.github.io/") {
      return "https://anivaryam.github.io/";
    }
    
    // Check if URL has a file extension (don't add slash to files)
    const hasFileExtension = /\.(xml|txt|html|json|ico|png|jpg|jpeg|svg|webmanifest|js|css|woff|woff2|ttf|eot|wasm|pdf|zip)$/i.test(url);
    
    if (hasFileExtension) {
      return url; // Don't add slash to files
    }
    
    // Remove trailing slash if present (to match static HTML)
    return url.endsWith('/') ? url.slice(0, -1) : url;
  };

  const normalizedCanonical = normalizeCanonical(canonical);

  useEffect(() => {
    // Update document title only if different (prevents unnecessary DOM changes)
    if (document.title !== fullTitle) {
      document.title = fullTitle;
    }

    // Helper to update or create meta tag
    // Only update if content differs - this prevents unnecessary DOM updates
    // that cause Ahrefs to show both HTML and Rendered columns
    // Static HTML should match React exactly, so no updates needed
    const setMetaTag = (
      attribute: "name" | "property",
      key: string,
      content: string
    ) => {
      let element = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
        element.setAttribute("content", content);
      } else {
        // Only update if content is different (prevents unnecessary DOM changes)
        const currentContent = element.getAttribute("content");
        if (currentContent !== content) {
          element.setAttribute("content", content);
        }
      }
    };

    // Basic meta tags
    setMetaTag("name", "description", truncatedDescription);
    setMetaTag("name", "robots", "index, follow");

    // Open Graph tags
    setMetaTag("property", "og:title", fullTitle);
    setMetaTag("property", "og:description", truncatedDescription);
    setMetaTag("property", "og:type", ogType);
    setMetaTag("property", "og:site_name", siteName);
    if (ogImage) setMetaTag("property", "og:image", ogImage);
    if (normalizedCanonical) setMetaTag("property", "og:url", normalizedCanonical);

    // Twitter Card tags
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", fullTitle);
    setMetaTag("name", "twitter:description", truncatedDescription);
    if (ogImage) setMetaTag("name", "twitter:image", ogImage);

    // Article-specific meta tags
    if (ogType === "article" && article) {
      if (article.publishedTime) {
        setMetaTag("property", "article:published_time", article.publishedTime);
      }
      if (article.author) {
        setMetaTag("property", "article:author", article.author);
      }
    }

    // Canonical link - only update if different
    // Use normalized canonical URL to ensure trailing slash consistency
    let canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement;
    if (normalizedCanonical) {
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
        canonicalLink.href = normalizedCanonical;
      } else if (canonicalLink.href !== normalizedCanonical) {
        // Only update if href is different (prevents unnecessary DOM changes)
        canonicalLink.href = normalizedCanonical;
      }
    }

    // Structured Data (JSON-LD)
    const baseUrl = "https://anivaryam.github.io";
    let structuredDataScript = document.querySelector(
      'script[type="application/ld+json"]'
    ) as HTMLScriptElement;

    if (structuredData) {
      let jsonLd: any = {
        "@context": "https://schema.org",
      };

      if (structuredData.type === "WebSite") {
        const today = new Date().toISOString().split('T')[0];
        jsonLd["@type"] = "WebSite";
        jsonLd.name = siteName;
        jsonLd.description = truncatedDescription;
        jsonLd.url = baseUrl;
        jsonLd.datePublished = today;
        jsonLd.dateModified = today;
        jsonLd.potentialAction = {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/tools?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        };
      } else if (structuredData.type === "SoftwareApplication") {
        jsonLd["@type"] = "SoftwareApplication";
        jsonLd.name = title.replace(` | ${siteName}`, "");
        jsonLd.description = truncatedDescription;
        jsonLd.url = normalizedCanonical || baseUrl;
        jsonLd.datePublished = new Date().toISOString().split('T')[0];
        jsonLd.dateModified = new Date().toISOString().split('T')[0];
        jsonLd.applicationCategory = structuredData.applicationCategory || "DeveloperApplication";
        jsonLd.operatingSystem = structuredData.operatingSystem || "Web Browser";
        jsonLd.offers = structuredData.offers || {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        };
        jsonLd.softwareVersion = "1.0";
      } else if (structuredData.type === "Article" && article) {
        jsonLd["@type"] = "Article";
        jsonLd.headline = truncateTitle(title, 110); // Article headlines can be longer
        jsonLd.description = truncatedDescription;
        jsonLd.url = normalizedCanonical || baseUrl;
        if (article.publishedTime) {
          jsonLd.datePublished = article.publishedTime;
          jsonLd.dateModified = article.publishedTime;
        } else {
          jsonLd.datePublished = new Date().toISOString().split('T')[0];
          jsonLd.dateModified = new Date().toISOString().split('T')[0];
        }
        if (article.author) {
          jsonLd.author = {
            "@type": "Person",
            name: article.author,
          };
        }
        if (article.tags) {
          jsonLd.keywords = article.tags.join(", ");
        }
      } else {
        const today = new Date().toISOString().split('T')[0];
        jsonLd["@type"] = "WebPage";
        jsonLd.name = truncateTitle(title, 60);
        jsonLd.description = truncatedDescription;
        jsonLd.url = normalizedCanonical || baseUrl;
        jsonLd.datePublished = today;
        jsonLd.dateModified = today;
      }

      if (!structuredDataScript) {
        structuredDataScript = document.createElement("script");
        structuredDataScript.type = "application/ld+json";
        document.head.appendChild(structuredDataScript);
      }
      structuredDataScript.textContent = JSON.stringify(jsonLd);
    } else {
      // Default WebSite schema for homepage
      if (!normalizedCanonical || normalizedCanonical === baseUrl || normalizedCanonical === `${baseUrl}/`) {
        if (!structuredDataScript) {
          structuredDataScript = document.createElement("script");
          structuredDataScript.type = "application/ld+json";
          document.head.appendChild(structuredDataScript);
        }
        const today = new Date().toISOString().split('T')[0];
        const defaultSchema = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteName,
          description: truncatedDescription,
          url: baseUrl,
          datePublished: today,
          dateModified: today,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${baseUrl}/tools?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        };
        structuredDataScript.textContent = JSON.stringify(defaultSchema);
      }
    }

    // Add BreadcrumbList schema if breadcrumbs are provided
    if (breadcrumbs && breadcrumbs.length > 0) {
      let breadcrumbScript = document.querySelector(
        'script[data-breadcrumb-schema]'
      ) as HTMLScriptElement;
      
      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": crumb.name,
          "item": crumb.url,
        })),
      };

      if (!breadcrumbScript) {
        breadcrumbScript = document.createElement("script");
        breadcrumbScript.type = "application/ld+json";
        breadcrumbScript.setAttribute("data-breadcrumb-schema", "true");
        document.head.appendChild(breadcrumbScript);
      }
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
    }

    // Cleanup function
    return () => {
      document.title = siteName;
    };
  }, [fullTitle, truncatedDescription, normalizedCanonical, ogImage, ogType, article, structuredData, breadcrumbs]);

  return null;
}
