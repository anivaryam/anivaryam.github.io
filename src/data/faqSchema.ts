// FAQPage Schema.org JSON-LD
// This schema is injected into the page head for Google rich snippets
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "datePublished": "2026-01-07",
  "dateModified": new Date().toISOString().split("T")[0], // Dynamic date
  "author": {
    "@type": "Organization",
    "name": "Anivaryam",
    "url": "https://anivaryam.github.io"
  },
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What free online developer tools are available on Anivaryam?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Anivaryam provides 20+ free online developer tools, all browser-based with no signup required: Document Conversion: Word to HTML converter, CSV to JSON converter; Code Formatting: JSON formatter, text diff tool, code cleanup utilities; Encoding & Decoding: Base64 encoder/decoder, URL encoder/decoder, hash generator, JWT decoder; Data Generation: UUID generator, QR code generator, timestamp converter; Testing & Utilities: regex tester, web scraper, color converter, image tool; Cryptography: Random Universe Cipher (post-quantum encryption). All tools run entirely in your browser—no server uploads, no data storage, complete privacy."
      },
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://github.com/anivaryam/anivaryam.github.io"
    },
    {
      "@type": "Question",
      "name": "Are Anivaryam tools really free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! All 20+ developer tools are completely free with no hidden costs, premium tiers, or credit card required. Use any tool unlimited times—no registration, no signup, no restrictions."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Do I need to create an account to use the tools?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No account needed. All free online developer tools are available instantly without signup. Simply visit any tool page and start using it immediately. Ideal for privacy-conscious developers who want browser-based tools with no registration."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "What is Anivaryam?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Anivaryam is a collection of 20+ free online developer tools designed to streamline your workflow. We offer tools for converting Word documents to HTML, formatting JSON, encoding/decoding Base64, generating hashes and UUIDs, testing regex patterns, scraping websites, and more. All tools run entirely in your browser with no signup required."
      },
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://github.com/anivaryam/anivaryam.github.io"
    },
    {
      "@type": "Question",
      "name": "Is my data private when using Anivaryam tools?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, your data is completely private. All tools run entirely in your browser using client-side processing. Your content never leaves your device—it's never uploaded to any server, stored, or tracked. This makes Anivaryam perfect for handling sensitive documents, proprietary code, and confidential information."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Does Anivaryam store or track my data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, we don't store, track, or analyze any of your data. Since all processing happens client-side in your browser, there's no data transmission to our servers. We don't use cookies for tracking, and we don't collect analytics on your usage. Your privacy is our priority."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Are Anivaryam tools safe for confidential data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely! Because all tools process data locally in your browser without any server uploads, Anivaryam is safe for sensitive documents, proprietary code, passwords, API keys, and other confidential information. Your data never leaves your device—ideal for privacy-conscious developers."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Are the tools secure?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, all tools are secure by design. Since processing happens entirely in your browser, there's no risk of data interception during transmission. Additionally, Anivaryam is open-source, so you can review the code to verify security practices."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "How do I use Anivaryam tools?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Using our free online developer tools is simple: 1. Navigate to the tool you need from the Tools page 2. Paste or enter your content in the input field 3. Configure any options (if available) 4. Click the process/convert button 5. Copy the result from the output field. No installation, no signup, no waiting—just instant results in your browser."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "What browsers are supported?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Anivaryam tools work in all modern browsers including Chrome, Firefox, Safari, Edge, and Opera. The tools use standard web technologies and should work on any browser that supports JavaScript. For the best experience, we recommend using the latest version of your browser."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Can I use Anivaryam tools offline?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our browser-based Anivaryam tools require an internet connection to load initially, but once loaded, many tools work offline depending on your browser's caching. However, some features might be limited offline (such as external API calls or real-time validation), so for the best experience and access to all features, we recommend using Anivaryam tools with an internet connection."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Are there any usage limits or rate limits?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, there are no usage limits or rate limits. You can use any tool as many times as you need, process as much data as you want, and use multiple tools simultaneously. All browser-based tools are completely unrestricted."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Are Anivaryam tools free for commercial use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, you can use Anivaryam tools for any purpose, including commercial use. The tools are free and open-source under the MIT license, which allows commercial use, modification, and distribution."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Can I save my work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "While tools don't have built-in save functionality, you can easily copy results from any tool's output field. All processing happens instantly, so you can copy and paste results into your preferred storage solution."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Can I use tools on mobile devices?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! All Anivaryam tools are fully responsive and work seamlessly on mobile devices, tablets, and desktops. Our browser-based tools are mobile-friendly and adapt automatically to different screen sizes. Use our free online JSON formatter, Base64 encoder, or Word to HTML converter on smartphones and tablets—no app installation required."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Convert Word to HTML for blog posts?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our Word to HTML converter at https://anivaryam.github.iotoolsword-to-html/ to convert Word to HTML for blog posts: 1. Copy your content from Microsoft Word 2. Paste it into the converter 3. Select Blog mode for SEO-friendly formatting optimized for blog posts 4. Click convert to get clean, semantic HTML 5. Copy the output and paste into your blog CMS. The Blog mode removes Word bloat while preserving headings, lists, and emphasis—ideal for Word to HTML converter for blog posts. Learn advanced techniques in our Word to HTML conversion guide at https://anivaryam.github.ioblogs/how-to-convert-word-html-clean-seo-friendly/."
      },
      "url": "https://anivaryam.github.iotoolsword-to-html/",
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://anivaryam.github.ioblogs/how-to-convert-word-html-clean-seo-friendly/"
    },
    {
      "@type": "Question",
      "name": "Web Scraper: extract data from websites?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our free web scraper tool at https://anivaryam.github.iotoolsweb-scraper/ to extract data from websites quickly: 1. Visit the Web Scraper tool 2. Enter the website URL you want to scrape 3. Use CSS selectors to target specific elements (e.g., .title, #content, article p) 4. Click Scrape to extract the data 5. Copy the extracted results. Our browser-based web scraper works best with publicly accessible HTML content. For JavaScript-rendered sites or advanced techniques, see our web scraping tutorial at https://anivaryam.github.ioblogs/how-to-scrape-any-website-free-web-scraper/ covering CSS selector strategies and data extraction best practices."
      },
      "url": "https://anivaryam.github.iotoolsweb-scraper/",
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://anivaryam.github.ioblogs/how-to-scrape-any-website-free-web-scraper/"
    },
    {
      "@type": "Question",
      "name": "How do I generate a SHA-256 hash online?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Generate SHA-256 hashes instantly using our hash generator at https://anivaryam.github.iotoolshash-generator/: 1. Visit the Hash Generator tool 2. Enter your text or password 3. Select SHA-256 from the algorithm dropdown 4. Click Generate Hash 5. Copy the generated hash. Our free online hash generator supports SHA-1, SHA-256, SHA-384, and SHA-512 algorithms. All hashing happens locally in your browser—ideal for privacy-conscious developers who need secure hash generation with no signup required."
      },
      "url": "https://anivaryam.github.iotoolshash-generator/",
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "How to generate a UUID?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Generate UUIDs instantly using our UUID generator at https://anivaryam.github.iotoolsuuid-generator/: 1. Visit the UUID Generator tool 2. Choose how many UUIDs you need (single or multiple) 3. Click Generate UUID 4. Copy the generated UUID(s). Our browser-based UUID generator creates version 4 UUIDs instantly. Perfect for database IDs, API keys, and unique identifiers. All generation happens locally—use our free online UUID generator with no registration required."
      },
      "url": "https://anivaryam.github.iotoolsuuid-generator/",
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "How does the Word to HTML converter work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our Word to HTML converter at https://anivaryam.github.iotoolsword-to-html/ to clean up messy HTML generated by Microsoft Word. It removes bloated inline styles, mso- attributes, unnecessary span tags, and broken spacing. Choose from three modes: Regular (clean HTML output), Blog (optimized for blog posts and SEO-friendly formatting), and Shoppables (perfect for e-commerce product descriptions). All processing happens in your browser—no server uploads. Learn more in our comprehensive Word to HTML conversion guide at https://anivaryam.github.ioblogs/how-to-convert-word-html-clean-seo-friendly/."
      },
      "url": "https://anivaryam.github.iotoolsword-to-html/",
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://anivaryam.github.ioblogs/how-to-convert-word-html-clean-seo-friendly/"
    },
    {
      "@type": "Question",
      "name": "What hash algorithms does the Hash Generator support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our hash generator at https://anivaryam.github.iotoolshash-generator/ to generate hashes with multiple algorithms including SHA-1, SHA-256, SHA-384, and SHA-512. Generate hashes for passwords, data integrity verification, and cryptographic purposes. All hashing happens locally in your browser—ideal for privacy-conscious developers who need secure hash generation with no signup required. Use our free online hash generator to create secure hashes instantly."
      },
      "url": "https://anivaryam.github.iotoolshash-generator/",
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Can the Web Scraper extract data from any website?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use our free web scraper tool at https://anivaryam.github.iotoolsweb-scraper/ to extract data from websites quickly. It uses CSS selectors and works best with publicly accessible content. However, it cannot bypass authentication, handle JavaScript-rendered content that requires browser execution, or access content behind paywalls or login pages. Perfect for data collection and research, our browser-based web scraper requires no signup and processes everything locally. Learn more about web scraping techniques at https://anivaryam.github.ioblogs/how-to-scrape-any-website-free-web-scraper/."
      },
      "url": "https://anivaryam.github.iotoolsweb-scraper/",
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://anivaryam.github.ioblogs/how-to-scrape-any-website-free-web-scraper/"
    },
    {
      "@type": "Question",
      "name": "What is the Random Universe Cipher?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Random Universe Cipher at https://anivaryam.github.iotoolsrandom-universe-cipher/ (RUC) is a 256-bit quantum-resistant symmetric encryption cipher designed for post-quantum security. It provides advanced cryptographic protection suitable for sensitive data that needs to remain secure even against quantum computers. For detailed information about quantum-resistant encryption and how RUC works, see our comprehensive post-quantum security blog post at https://anivaryam.github.ioblogs/random-universe-cipher-ruc-post-quantum-security/."
      },
      "url": "https://anivaryam.github.iotoolsrandom-universe-cipher/",
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://anivaryam.github.ioblogs/random-universe-cipher-ruc-post-quantum-security/"
    },
    {
      "@type": "Question",
      "name": "How accurate are the conversion tools?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our Anivaryam conversion tools are highly accurate: Use our Word to HTML converter at https://anivaryam.github.iotoolsword-to-html/ to preserve formatting while cleaning up bloated code—perfect for Word to HTML converter for blog posts; Use our CSV to JSON converter at https://anivaryam.github.iotoolscsv-to-json/ to handle various delimiters and data types accurately; Use our Base64 encoder/decoder at https://anivaryam.github.iotoolsbase64/ to support UTF-8 encoding for international characters—our browser-based Base64 encoder is free. All Anivaryam tools process data locally in your browser, ensuring consistent results."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Is Anivaryam open source?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Anivaryam is completely open-source. The code is available on GitHub, and you can review it, contribute improvements, or use it as a reference for your own projects. The project is licensed under the MIT license."
      },
      "image": "https://anivaryam.github.ioicon-192.png",
      "sameAs": "https://github.com/anivaryam/anivaryam.github.io"
    },
    {
      "@type": "Question",
      "name": "Can I contribute to Anivaryam?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! Anivaryam welcomes contributions. You can contribute by: Reporting bugs or suggesting features through our Issues page at https://anivaryam.github.ioissues/; Submitting pull requests with improvements on GitHub; Sharing feedback and ideas; Helping improve documentation."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "What if I encounter a bug or have a feature request?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If you encounter a bug or have a feature request, please visit our Issues page at https://anivaryam.github.ioissues/ or submit an issue on GitHub. We actively monitor feedback and work to improve the tools based on user needs."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Do the tools work with large files?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Most Anivaryam tools can handle reasonably large inputs, but performance depends on your device's capabilities and browser memory. For extremely large files (hundreds of MB), you may experience slower processing. We recommend testing with your specific use case."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Do you offer API access?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We don't currently offer API access, but all tools are open-source under the MIT license. You can review the code, modify it for your needs, or deploy your own instance. The tools are designed to run client-side in browsers."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "What downloadable resources does Anivaryam offer?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Anivaryam offers free downloads including: Windows automation scripts; PERN stack setup templates; PostgreSQL database manager utilities; School project templates; Other time-saving development tools. Browse all free downloads at https://anivaryam.github.iodownloads/ on our downloads page. All downloads are free and open-source."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Are there tutorials or guides available?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! Anivaryam includes a blog section at https://anivaryam.github.ioblogs/ with comprehensive tutorials, tips, and developer guides. Learn about web scraping, cryptography, post-quantum security, database management, and more. New articles are published regularly."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    },
    {
      "@type": "Question",
      "name": "Can students use Anivaryam for school projects?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely! Anivaryam offers ready-to-use school project templates at https://anivaryam.github.ioschool-projects/ perfect for students and educators. These templates include pre-configured project structures, documentation, and examples—perfect for assignments, capstone projects, and learning new technologies."
      },
      "image": "https://anivaryam.github.ioicon-192.png"
    }
  ]
};

