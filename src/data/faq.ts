export interface FAQItem {
  question: string;
  answer: string;
  category: string;
  categoryIcon?: string;
}

export const faqCategories = [
  { id: "general", name: "General Questions" },
  { id: "privacy", name: "Privacy & Security" },
  { id: "usage", name: "Usage & Features" },
  { id: "tools", name: "Specific Tools" },
  { id: "technical", name: "Technical & Support" },
  { id: "downloads", name: "Downloads & Resources" },
];

export const faqData: FAQItem[] = [
  // General Questions
  {
    question: "What free online developer tools are available on Anivaryam?",
    answer: "Anivaryam provides 20+ free online developer tools, all browser-based with no signup required:\n\n• **Document Conversion**: [Word to HTML converter](/tools/word-to-html/), [CSV to JSON converter](/tools/csv-to-json/)\n• **Code Formatting**: [JSON formatter](/tools/json-formatter/), [text diff tool](/tools/text-diff/), code cleanup utilities\n• **Encoding & Decoding**: [Base64 encoder/decoder](/tools/base64/), [URL encoder/decoder](/tools/url-encoder/), [hash generator](/tools/hash-generator/), [JWT decoder](/tools/jwt-decoder/)\n• **Data Generation**: [UUID generator](/tools/uuid-generator/), [QR code generator](/tools/qr-code-generator/), [timestamp converter](/tools/timestamp-converter/)\n• **Testing & Utilities**: [regex tester](/tools/regex-tester/), [web scraper](/tools/web-scraper/), [color converter](/tools/color-converter/), [image tool](/tools/image-tool/)\n• **Cryptography**: [Random Universe Cipher](/tools/random-universe-cipher/) (post-quantum encryption)\n\nAll tools run entirely in your browser—no server uploads, no data storage, complete privacy.",
    category: "general",
  },
  {
    question: "Are Anivaryam tools really free?",
    answer: "Yes! All 20+ developer tools are completely free with no hidden costs, premium tiers, or credit card required. Use any tool unlimited times—no registration, no signup, no restrictions.",
    category: "general",
  },
  {
    question: "Do I need to create an account to use the tools?",
    answer: "No account needed. All **free online developer tools** are available instantly **without signup**. Simply visit any tool page and start using it immediately. Ideal for **privacy-conscious developers** who want **browser-based tools with no registration**.",
    category: "general",
  },
  {
    question: "What is Anivaryam?",
    answer: "Anivaryam is a collection of 20+ free online developer tools designed to streamline your workflow. We offer tools for converting Word documents to HTML, formatting JSON, encoding/decoding Base64, generating hashes and UUIDs, testing regex patterns, scraping websites, and more. All tools run entirely in your browser with no signup required.",
    category: "general",
  },
  // Privacy & Security
  {
    question: "Is my data private when using Anivaryam tools?",
    answer: "Yes, your data is completely private. All tools run entirely in your browser using client-side processing. Your content never leaves your device—it's never uploaded to any server, stored, or tracked. This makes Anivaryam perfect for handling sensitive documents, proprietary code, and confidential information.",
    category: "privacy",
  },
  {
    question: "Does Anivaryam store or track my data?",
    answer: "No, we don't store, track, or analyze any of your data. Since all processing happens client-side in your browser, there's no data transmission to our servers. We don't use cookies for tracking, and we don't collect analytics on your usage. Your privacy is our priority.",
    category: "privacy",
  },
  {
    question: "Are Anivaryam tools safe for confidential data?",
    answer: "Absolutely! Because all tools process data locally in your browser without any server uploads, Anivaryam is safe for sensitive documents, proprietary code, passwords, API keys, and other confidential information. Your data never leaves your device—ideal for **privacy-conscious developers**.",
    category: "privacy",
  },
  {
    question: "Are the tools secure?",
    answer: "Yes, all tools are secure by design. Since processing happens entirely in your browser, there's no risk of data interception during transmission. Additionally, Anivaryam is open-source, so you can review the code to verify security practices.",
    category: "privacy",
  },
  // Usage & Features
  {
    question: "How do I use Anivaryam tools?",
    answer: "Using our free online developer tools is simple:\n1. Navigate to the tool you need from the [Tools page](/tools/)\n2. Paste or enter your content in the input field\n3. Configure any options (if available)\n4. Click the process/convert button\n5. Copy the result from the output field\n\nNo installation, no signup, no waiting—just instant results in your browser.",
    category: "usage",
  },
  {
    question: "What browsers are supported?",
    answer: "Anivaryam tools work in all modern browsers including Chrome, Firefox, Safari, Edge, and Opera. The tools use standard web technologies and should work on any browser that supports JavaScript. For the best experience, we recommend using the latest version of your browser.",
    category: "usage",
  },
  {
    question: "Can I use Anivaryam tools offline?",
    answer: "Our **browser-based Anivaryam tools** require an internet connection to load initially, but once loaded, many tools work offline depending on your browser's caching. However, some features might be limited offline (such as external API calls or real-time validation), so for the best experience and access to all features, we recommend using Anivaryam tools with an internet connection.",
    category: "usage",
  },
  {
    question: "Are there any usage limits or rate limits?",
    answer: "No, there are no usage limits or rate limits. You can use any tool as many times as you need, process as much data as you want, and use multiple tools simultaneously. All browser-based tools are completely unrestricted.",
    category: "usage",
  },
  {
    question: "Are Anivaryam tools free for commercial use?",
    answer: "Yes, you can use Anivaryam tools for any purpose, including commercial use. The tools are free and open-source under the MIT license, which allows commercial use, modification, and distribution.",
    category: "usage",
  },
  {
    question: "Can I save my work?",
    answer: "While tools don't have built-in save functionality, you can easily copy results from any tool's output field. All processing happens instantly, so you can copy and paste results into your preferred storage solution.",
    category: "usage",
  },
  {
    question: "Can I use tools on mobile devices?",
    answer: "Yes! All Anivaryam tools are fully responsive and work seamlessly on mobile devices, tablets, and desktops. Our **browser-based tools are mobile-friendly** and adapt automatically to different screen sizes. Use our **free online JSON formatter**, **Base64 encoder**, or **Word to HTML converter** on smartphones and tablets—no app installation required.",
    category: "usage",
  },
  {
    question: "Convert Word to HTML for blog posts?",
    answer: "Use our [Word to HTML converter](/tools/word-to-html/) to convert Word to HTML for blog posts:\n1. Copy your content from Microsoft Word\n2. Paste it into the converter\n3. Select **Blog mode** for SEO-friendly formatting optimized for blog posts\n4. Click convert to get clean, semantic HTML\n5. Copy the output and paste into your blog CMS\n\nThe Blog mode removes Word bloat while preserving headings, lists, and emphasis—ideal for **Word to HTML converter for blog posts**. Learn advanced techniques in our [Word to HTML conversion guide](/blogs/how-to-convert-word-html-clean-seo-friendly/).",
    category: "usage",
  },
  {
    question: "Web Scraper: extract data from websites?",
    answer: "Use our [free web scraper tool](/tools/web-scraper/) to extract data from websites quickly:\n1. Visit the Web Scraper tool\n2. Enter the website URL you want to scrape\n3. Use CSS selectors to target specific elements (e.g., `.title`, `#content`, `article p`)\n4. Click \"Scrape\" to extract the data\n5. Copy the extracted results\n\nOur **browser-based web scraper** works best with publicly accessible HTML content. For JavaScript-rendered sites or advanced techniques, see our [web scraping tutorial](/blogs/how-to-scrape-any-website-free-web-scraper/) covering CSS selector strategies and data extraction best practices.",
    category: "usage",
  },
  {
    question: "How do I generate a SHA-256 hash online?",
    answer: "Generate SHA-256 hashes instantly using our [hash generator](/tools/hash-generator/):\n1. Visit the Hash Generator tool\n2. Enter your text or password\n3. Select SHA-256 from the algorithm dropdown\n4. Click \"Generate Hash\"\n5. Copy the generated hash\n\nOur **free online hash generator** supports SHA-1, SHA-256, SHA-384, and SHA-512 algorithms. All hashing happens locally in your browser—ideal for **privacy-conscious developers** who need secure hash generation with **no signup required**.",
    category: "usage",
  },
  {
    question: "How to generate a UUID?",
    answer: "Generate UUIDs instantly using our [UUID generator](/tools/uuid-generator/):\n1. Visit the UUID Generator tool\n2. Choose how many UUIDs you need (single or multiple)\n3. Click \"Generate UUID\"\n4. Copy the generated UUID(s)\n\nOur **browser-based UUID generator** creates version 4 UUIDs instantly. Perfect for database IDs, API keys, and unique identifiers. All generation happens locally—use our **free online UUID generator** with **no registration required**.",
    category: "usage",
  },
  // Specific Tools
  {
    question: "How does the Word to HTML converter work?",
    answer: "Use our [Word to HTML converter](/tools/word-to-html/) to clean up messy HTML generated by Microsoft Word. It removes bloated inline styles, mso- attributes, unnecessary span tags, and broken spacing. Choose from three modes:\n• **Regular**: Clean HTML output\n• **Blog**: Optimized for **blog posts and SEO-friendly formatting**\n• **Shoppables**: Perfect for e-commerce product descriptions\n\nAll processing happens in your browser—no server uploads. Learn more in our comprehensive [Word to HTML conversion guide](/blogs/how-to-convert-word-html-clean-seo-friendly/) covering SEO optimization, HTML cleanup techniques, and best practices for content conversion.",
    category: "tools",
  },
  {
    question: "What hash algorithms does the Hash Generator support?",
    answer: "Use our [hash generator](/tools/hash-generator/) to generate hashes with multiple algorithms including SHA-1, SHA-256, SHA-384, and SHA-512. Generate hashes for passwords, data integrity verification, and cryptographic purposes. All hashing happens locally in your browser—ideal for **privacy-conscious developers** who need secure hash generation with **no signup required**. Use our **free online hash generator** to create secure hashes instantly.",
    category: "tools",
  },
  {
    question: "Can the Web Scraper extract data from any website?",
    answer: "Use our [free web scraper tool](/tools/web-scraper/) to extract data from websites quickly. It uses CSS selectors and works best with publicly accessible content. However, it cannot bypass authentication, handle JavaScript-rendered content that requires browser execution, or access content behind paywalls or login pages.\n\nPerfect for **data collection and research**, our **browser-based web scraper** requires no signup and processes everything locally. Learn more about [web scraping techniques](/blogs/how-to-scrape-any-website-free-web-scraper/) including CSS selector strategies, data extraction best practices, and ethical scraping guidelines.",
    category: "tools",
  },
  {
    question: "What is the Random Universe Cipher?",
    answer: "The [Random Universe Cipher](/tools/random-universe-cipher/) (RUC) is a **256-bit quantum-resistant symmetric encryption cipher** designed for **post-quantum security**. It provides advanced cryptographic protection suitable for sensitive data that needs to remain secure even against quantum computers. For detailed information about **quantum-resistant encryption** and how RUC works, see our comprehensive [post-quantum security blog post](/blogs/random-universe-cipher-ruc-post-quantum-security/) covering encryption algorithms, security analysis, and implementation details.",
    category: "tools",
  },
  {
    question: "How accurate are the conversion tools?",
    answer: "Our Anivaryam conversion tools are highly accurate:\n• Use our [Word to HTML converter](/tools/word-to-html/) to preserve formatting while cleaning up bloated code—perfect for **Word to HTML converter for blog posts**\n• Use our [CSV to JSON converter](/tools/csv-to-json/) to handle various delimiters and data types accurately\n• Use our [Base64 encoder/decoder](/tools/base64/) to support UTF-8 encoding for international characters—our **browser-based Base64 encoder** is free\n\nAll Anivaryam tools process data locally in your browser, ensuring consistent results.",
    category: "tools",
  },
  // Technical & Support
  {
    question: "Is Anivaryam open source?",
    answer: "Yes, Anivaryam is completely open-source. The code is available on GitHub, and you can review it, contribute improvements, or use it as a reference for your own projects. The project is licensed under the MIT license.",
    category: "technical",
  },
  {
    question: "Can I contribute to Anivaryam?",
    answer: "Yes! Anivaryam welcomes contributions. You can contribute by:\n• Reporting bugs or suggesting features through our [Issues page](/issues/)\n• Submitting pull requests with improvements on GitHub\n• Sharing feedback and ideas\n• Helping improve documentation",
    category: "technical",
  },
  {
    question: "What if I encounter a bug or have a feature request?",
    answer: "If you encounter a bug or have a feature request, please visit our [Issues page](/issues/) or submit an issue on GitHub. We actively monitor feedback and work to improve the tools based on user needs.",
    category: "technical",
  },
  {
    question: "Do the tools work with large files?",
    answer: "Most Anivaryam tools can handle reasonably large inputs, but performance depends on your device's capabilities and browser memory. For extremely large files (hundreds of MB), you may experience slower processing. We recommend testing with your specific use case.",
    category: "technical",
  },
  {
    question: "Do you offer API access?",
    answer: "We don't currently offer API access, but all tools are open-source under the MIT license. You can review the code, modify it for your needs, or deploy your own instance. The tools are designed to run client-side in browsers.",
    category: "technical",
  },
  // Downloads & Resources
  {
    question: "What downloadable resources does Anivaryam offer?",
    answer: "Anivaryam offers free downloads including: Windows automation scripts; PERN stack setup templates; PostgreSQL database manager utilities; School project templates; Other time-saving development tools. Browse all free downloads at [https://anivaryam.github.io/downloads/](/downloads/) on our downloads page. All downloads are free and open-source.",
    category: "downloads",
  },
  {
    question: "Are there tutorials or guides available?",
    answer: "Yes! Anivaryam includes a blog section at [https://anivaryam.github.io/blogs/](/blogs/) with comprehensive tutorials, tips, and developer guides. Learn about web scraping, cryptography, post-quantum security, database management, and more. New articles are published regularly.",
    category: "downloads",
  },
  {
    question: "Can students use Anivaryam for school projects?",
    answer: "Absolutely! Anivaryam offers ready-to-use school project templates at [https://anivaryam.github.io/school-projects/](/school-projects/) perfect for students and educators. These templates include pre-configured project structures, documentation, and examples—perfect for assignments, capstone projects, and learning new technologies.",
    category: "downloads",
  },
];

