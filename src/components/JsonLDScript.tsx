import { Organization, Website, BreadcrumbList } from "lucide-react";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Anivaryam",
  "url": "https://anivaryam.github.io",
  "logo": "https://anivaryam.github.io/icon-512.png",
  "description": "Free online developer tools for text, code, and document conversion. No signup required.",
  "sameAs": [
    "https://github.com/anivaryam/anivaryam.github.io"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "anivaryam.dev@gmail.com",
    "contactType": "technical support"
  }
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Anivaryam Developer Tools",
  "url": "https://anivaryam.github.io",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://anivaryam.github.io/tools?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://anivaryam.github.io/"
    }
  ]
};

export function JsonLDScript() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
