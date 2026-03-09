# Anivaryam

> Developer tools for converting, automating, and building. From Word to HTML converters to database visualization—we've got you covered.

[![Live Site](https://img.shields.io/badge/Live%20Site-anivaryam.github.io-22c55e?style=flat-square)](https://anivaryam.github.io)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

Anivaryam is a collection of powerful, free online developer tools designed to streamline your workflow. Whether you need to convert Word documents to HTML, format JSON, encode/decode Base64, or manage databases, Anivaryam has the tools you need.

##  Features

### Text & Formatting Tools
- **Word to HTML Converter** - Convert Word documents to clean, semantic HTML with multiple output formats
- **JSON Formatter** - Beautify and validate JSON with syntax highlighting
- **JSON Data Extractor** - Extract specific data from JSON using path syntax
- **CSV to JSON Converter** - Convert between CSV and JSON formats
- **Text Diff Tool** - Compare two texts and see differences

### Encoding & Decoding Tools
- **Base64 Encoder/Decoder** - Encode and decode Base64 strings with UTF-8 support
- **URL Encoder/Decoder** - Encode and decode URL components
- **Hash Generator** - Generate MD5, SHA-1, SHA-256, and SHA-512 hashes
- **Hash Decoder** - Decode common hash formats
- **JWT Decoder** - Decode and inspect JWT tokens
- **JWT Encoder** - Create and encode JWT tokens

### Utility Tools
- **Color Converter** - Convert between HEX, RGB, HSL, and more
- **UUID Generator** - Generate version 4 UUIDs instantly
- **Regex Tester** - Test and debug regular expressions in real-time
- **Timestamp Converter** - Convert between Unix timestamps and human-readable dates
- **QR Code Generator** - Generate QR codes for WiFi, email, SMS, and more
- **Web Scraper** - Extract data from websites using CSS selectors
- **Image Tool** - Compress, convert formats, resize images, and generate favicons
- **Random Universe Cipher** - 256-bit quantum-resistant symmetric encryption cipher

##  Getting Started

### Prerequisites

- Node.js 20+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/anivaryam/anivaryam.github.io.git
cd anivaryam.github.io

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at `http://localhost:8000`

### Build for Production

```bash
npm run build
npm run preview
```

## 🛠️ Tech Stack

- **[Vite](https://vitejs.dev/)** - Next-generation frontend tooling
- **[React](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautiful, accessible components
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[React Router](https://reactrouter.com/)** - Client-side routing

##  Project Structure

```
anivaryam.github.io/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── lib/            # Utility functions and libraries
│   └── data/           # Static data (blog posts, etc.)
├── public/             # Static assets
└── .github/workflows/  # CI/CD configuration
```

## 🚢 Deployment

This project is configured for automatic deployment to GitHub Pages using GitHub Actions. The site is served at `https://anivaryam.github.io`.

### Manual Deployment

```bash
npm run build
```

The build output will be in the `dist/` directory, ready for deployment.

##  License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/anivaryam/anivaryam.github.io/issues).

---

Built with ❤️ by [Anivaryam](https://anivaryam.github.io)
