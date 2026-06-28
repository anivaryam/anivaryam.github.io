#!/usr/bin/env node
/**
 * Generate 1200x630 SVG cover images for blog posts.
 * Run with: node scripts/generate-blog-images.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'blog-images');

// Shared visual theme
const BG = '#0f172a';
const SURFACE = '#1e293b';
const BORDER = '#334155';
const TEXT = '#f1f5f9';
const MUTED = '#94a3b8';
const SITE = 'anivaryam.github.io';

function makeSvg({ name, category, tagline, accent, icon }) {
  const w = 1200, h = 630;
  // Category badge color
  const badgeBg = accent + '22';
  const badgeBorder = accent + '55';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="#0c1524"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${BORDER}" opacity="0.5"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>

  <!-- Glow blob top-right -->
  <ellipse cx="950" cy="200" rx="360" ry="260" fill="url(#glow)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="6" height="${h}" fill="${accent}"/>

  <!-- Top decorative line -->
  <line x1="6" y1="80" x2="${w}" y2="80" stroke="${BORDER}" stroke-width="1"/>

  <!-- Terminal dots row (top-left) -->
  <circle cx="34" cy="42" r="8" fill="#ef4444" opacity="0.8"/>
  <circle cx="60" cy="42" r="8" fill="#f59e0b" opacity="0.8"/>
  <circle cx="86" cy="42" r="8" fill="#22c55e" opacity="0.8"/>

  <!-- Site label (top right) -->
  <text x="${w - 40}" y="50" font-family="monospace" font-size="18" fill="${MUTED}" text-anchor="end">${SITE}</text>

  <!-- Category badge -->
  <rect x="60" y="130" width="${category.length * 11 + 28}" height="36" rx="18" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1"/>
  <text x="${60 + (category.length * 11 + 28) / 2}" y="154" font-family="monospace" font-size="15" font-weight="600" fill="${accent}" text-anchor="middle">${category}</text>

  <!-- Tool name -->
  ${renderWrappedText(name, 60, 230, 700, 72, TEXT, 'bold')}

  <!-- Tagline -->
  ${renderWrappedText(tagline, 60, 360, 680, 26, MUTED, 'normal')}

  <!-- Bottom border -->
  <line x1="6" y1="${h - 80}" x2="${w}" y2="${h - 80}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Bottom label -->
  <text x="60" y="${h - 42}" font-family="monospace" font-size="16" fill="${MUTED}">Free · Browser-based · No signup</text>

  <!-- Icon area (right side) -->
  <g transform="translate(780, 140)">${icon}</g>
</svg>`;
}

// Simple text wrapper — splits on spaces, max 2 lines
function renderWrappedText(text, x, y, maxW, size, fill, weight) {
  const words = text.split(' ');
  const charsPerLine = Math.floor(maxW / (size * 0.6));
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > charsPerLine && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = current ? current + ' ' + w : w;
    }
  }
  if (current) lines.push(current.trim());

  return lines.slice(0, 3).map((line, i) =>
    `<text x="${x}" y="${y + i * (size + 10)}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
  ).join('\n  ');
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// SVG icon snippets — drawn in a 340x340 canvas (transform applied above)
const icons = {
  'word-to-html': `
    <!-- Document -->
    <rect x="20" y="20" width="180" height="220" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <rect x="40" y="50" width="140" height="10" rx="5" fill="#3b82f6" opacity="0.7"/>
    <rect x="40" y="72" width="110" height="8" rx="4" fill="#334155"/>
    <rect x="40" y="90" width="130" height="8" rx="4" fill="#334155"/>
    <rect x="40" y="108" width="90" height="8" rx="4" fill="#334155"/>
    <rect x="40" y="140" width="140" height="8" rx="4" fill="#334155"/>
    <rect x="40" y="158" width="120" height="8" rx="4" fill="#334155"/>
    <!-- Arrow -->
    <path d="M220 130 L270 130" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
    <path d="M258 118 L272 130 L258 142" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- HTML block -->
    <rect x="280" y="60" width="180" height="150" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="295" y="100" font-family="monospace" font-size="14" fill="#60a5fa">&lt;h1&gt;</text>
    <text x="295" y="120" font-family="monospace" font-size="13" fill="#94a3b8">  Clean HTML</text>
    <text x="295" y="140" font-family="monospace" font-size="14" fill="#60a5fa">&lt;/h1&gt;</text>
    <text x="295" y="162" font-family="monospace" font-size="14" fill="#60a5fa">&lt;p&gt;...&lt;/p&gt;</text>`,

  'web-scraper': `
    <!-- Browser frame -->
    <rect x="10" y="10" width="340" height="240" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <rect x="10" y="10" width="340" height="40" rx="12" fill="#0f172a"/>
    <rect x="10" y="36" width="340" height="14" fill="#0f172a"/>
    <circle cx="34" cy="30" r="6" fill="#ef4444" opacity="0.8"/>
    <circle cx="54" cy="30" r="6" fill="#f59e0b" opacity="0.8"/>
    <circle cx="74" cy="30" r="6" fill="#22c55e" opacity="0.8"/>
    <rect x="90" y="20" width="200" height="20" rx="10" fill="#1e293b"/>
    <text x="190" y="34" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">https://example.com</text>
    <!-- Grid content -->
    <rect x="30" y="66" width="80" height="60" rx="6" fill="#0f172a" stroke="#334155"/>
    <rect x="120" y="66" width="80" height="60" rx="6" fill="#0f172a" stroke="#334155"/>
    <rect x="210" y="66" width="80" height="60" rx="6" fill="#0f172a" stroke="#334155"/>
    <rect x="300" y="66" width="34" height="60" rx="6" fill="#0f172a" stroke="#334155"/>
    <rect x="30" y="136" width="304" height="8" rx="4" fill="#334155"/>
    <rect x="30" y="154" width="240" height="8" rx="4" fill="#334155"/>
    <rect x="30" y="172" width="200" height="8" rx="4" fill="#334155"/>
    <!-- Extract arrow -->
    <path d="M175 270 L175 310" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
    <path d="M163 298 L175 312 L187 298" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Data output -->
    <rect x="60" y="318" width="240" height="80" rx="10" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <text x="80" y="345" font-family="monospace" font-size="12" fill="#10b981">[ "Item 1", "Item 2",</text>
    <text x="80" y="362" font-family="monospace" font-size="12" fill="#10b981">  "Item 3", "Item 4" ]</text>`,

  'random-universe-cipher': `
    <!-- Lock body -->
    <rect x="80" y="160" width="200" height="170" rx="20" fill="#1e293b" stroke="#8b5cf6" stroke-width="3"/>
    <!-- Lock shackle -->
    <path d="M110 160 L110 100 Q180 40 250 100 L250 160" stroke="#8b5cf6" stroke-width="8" fill="none" stroke-linecap="round"/>
    <!-- Keyhole -->
    <circle cx="180" cy="240" r="24" fill="#0f172a" stroke="#8b5cf6" stroke-width="2"/>
    <rect x="170" y="252" width="20" height="36" rx="4" fill="#0f172a" stroke="#8b5cf6" stroke-width="2"/>
    <!-- Binary around lock -->
    <text x="10" y="100" font-family="monospace" font-size="13" fill="#8b5cf6" opacity="0.4">10110101</text>
    <text x="280" y="200" font-family="monospace" font-size="13" fill="#8b5cf6" opacity="0.4">01001110</text>
    <text x="20" y="300" font-family="monospace" font-size="13" fill="#8b5cf6" opacity="0.4">11010010</text>
    <text x="270" y="320" font-family="monospace" font-size="13" fill="#8b5cf6" opacity="0.3">00111010</text>`,

  'db-manager': `
    <!-- DB cylinders -->
    <ellipse cx="160" cy="80" rx="110" ry="30" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <rect x="50" y="80" width="220" height="80" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <ellipse cx="160" cy="160" rx="110" ry="30" fill="#162032" stroke="#10b981" stroke-width="2"/>
    <rect x="50" y="160" width="220" height="80" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <ellipse cx="160" cy="240" rx="110" ry="30" fill="#162032" stroke="#10b981" stroke-width="2"/>
    <rect x="50" y="240" width="220" height="80" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <ellipse cx="160" cy="320" rx="110" ry="30" fill="#0d1a26" stroke="#10b981" stroke-width="2"/>
    <!-- Table rows inside -->
    <line x1="50" y1="112" x2="270" y2="112" stroke="#10b981" stroke-width="1" opacity="0.4"/>
    <line x1="50" y1="192" x2="270" y2="192" stroke="#10b981" stroke-width="1" opacity="0.4"/>
    <line x1="50" y1="272" x2="270" y2="272" stroke="#10b981" stroke-width="1" opacity="0.4"/>`,

  'google-bot': `
    <!-- GitHub logo simplified -->
    <circle cx="180" cy="140" r="100" fill="#1e293b" stroke="#f1f5f9" stroke-width="3"/>
    <path d="M180 60 C128 60 86 102 86 154 C86 196 112 231 148 244 C153 245 155 242 155 239 L155 226 C127 232 121 212 121 212 C116 200 109 196 109 196 C99 189 109 190 109 190 C120 191 126 202 126 202 C136 220 152 214 158 211 C159 204 162 199 165 196 C141 193 115 183 115 142 C115 130 119 120 127 113 C126 110 122 98 128 82 C128 82 137 79 155 91 C163 89 171 88 180 88 C189 88 197 89 205 91 C223 79 232 82 232 82 C238 98 234 110 233 113 C241 120 245 130 245 142 C245 183 219 193 195 196 C199 200 202 207 202 218 L202 239 C202 242 204 245 209 244 C245 231 271 196 271 154 C271 102 229 60 180 60Z" fill="#f1f5f9"/>
    <!-- 404 badge -->
    <rect x="240" y="60" width="80" height="38" rx="8" fill="#ef4444"/>
    <text x="280" y="84" font-family="monospace" font-size="16" font-weight="bold" fill="white" text-anchor="middle">404</text>`,

  'json-formatter': `
    <!-- JSON block -->
    <rect x="20" y="20" width="320" height="340" rx="14" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <rect x="20" y="20" width="320" height="36" rx="14" fill="#0f172a"/>
    <rect x="20" y="42" width="320" height="14" fill="#0f172a"/>
    <circle cx="42" cy="38" r="6" fill="#ef4444" opacity="0.8"/>
    <circle cx="62" cy="38" r="6" fill="#f59e0b" opacity="0.8"/>
    <circle cx="82" cy="38" r="6" fill="#22c55e" opacity="0.8"/>
    <text x="40" y="90" font-family="monospace" font-size="15" fill="#60a5fa">{</text>
    <text x="60" y="115" font-family="monospace" font-size="14" fill="#34d399">"name"</text>
    <text x="148" y="115" font-family="monospace" font-size="14" fill="#f1f5f9">: "JSON Tool",</text>
    <text x="60" y="140" font-family="monospace" font-size="14" fill="#34d399">"version"</text>
    <text x="160" y="140" font-family="monospace" font-size="14" fill="#f59e0b">: 2,</text>
    <text x="60" y="165" font-family="monospace" font-size="14" fill="#34d399">"features"</text>
    <text x="172" y="165" font-family="monospace" font-size="14" fill="#60a5fa">: [</text>
    <text x="80" y="190" font-family="monospace" font-size="14" fill="#f1f5f9">"format",</text>
    <text x="80" y="215" font-family="monospace" font-size="14" fill="#f1f5f9">"validate",</text>
    <text x="80" y="240" font-family="monospace" font-size="14" fill="#f1f5f9">"minify"</text>
    <text x="60" y="265" font-family="monospace" font-size="14" fill="#60a5fa">],</text>
    <text x="60" y="290" font-family="monospace" font-size="14" fill="#34d399">"free"</text>
    <text x="122" y="290" font-family="monospace" font-size="14" fill="#f59e0b">: true</text>
    <text x="40" y="320" font-family="monospace" font-size="15" fill="#60a5fa">}</text>`,

  'base64': `
    <!-- Binary to text -->
    <rect x="10" y="60" width="160" height="100" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="30" y="97" font-family="monospace" font-size="13" fill="#94a3b8">01001000</text>
    <text x="30" y="117" font-family="monospace" font-size="13" fill="#94a3b8">01100101</text>
    <text x="30" y="137" font-family="monospace" font-size="13" fill="#94a3b8">01101100</text>
    <!-- Arrow -->
    <path d="M180 110 L220 110" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
    <path d="M208 98 L222 110 L208 122" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Encoded -->
    <rect x="230" y="60" width="160" height="100" rx="10" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
    <text x="248" y="97" font-family="monospace" font-size="14" fill="#fbbf24">SGVsbG8</text>
    <text x="248" y="117" font-family="monospace" font-size="14" fill="#fbbf24">gV29ybGQ</text>
    <text x="248" y="137" font-family="monospace" font-size="14" fill="#fbbf24">h=</text>
    <!-- Decode arrow -->
    <path d="M180 220 L220 220" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 4"/>
    <path d="M192 208 L178 220 L192 232" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Text output -->
    <rect x="10" y="170" width="160" height="80" rx="10" fill="#1e293b" stroke="#22c55e" stroke-width="2"/>
    <text x="30" y="205" font-family="monospace" font-size="16" fill="#4ade80">Hello</text>
    <text x="30" y="228" font-family="monospace" font-size="16" fill="#4ade80">World!</text>`,

  'url-encoder': `
    <!-- URL bar -->
    <rect x="10" y="80" width="370" height="56" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="30" y="115" font-family="monospace" font-size="13" fill="#64748b">https://site.com/</text>
    <text x="192" y="115" font-family="monospace" font-size="13" fill="#60a5fa">hello%20world</text>
    <!-- Arrow down -->
    <path d="M190 156 L190 196" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
    <path d="M178 184 L190 198 L202 184" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Decoded -->
    <rect x="10" y="204" width="370" height="56" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="30" y="239" font-family="monospace" font-size="13" fill="#64748b">https://site.com/</text>
    <text x="192" y="239" font-family="monospace" font-size="14" fill="#4ade80">hello world</text>
    <!-- Encode symbols -->
    <text x="50" y="330" font-family="monospace" font-size="20" fill="#60a5fa" opacity="0.6">%20 %2F %3F</text>
    <text x="50" y="358" font-family="monospace" font-size="20" fill="#60a5fa" opacity="0.6">%3D %26 %23</text>`,

  'color-converter': `
    <!-- Color wheel simplified -->
    <circle cx="190" cy="190" r="130" fill="none" stroke="#334155" stroke-width="2"/>
    <!-- Colored segments -->
    <path d="M190 190 L320 190 A130 130 0 0 0 255 80 Z" fill="#ef4444" opacity="0.8"/>
    <path d="M190 190 L255 80 A130 130 0 0 0 125 80 Z" fill="#f59e0b" opacity="0.8"/>
    <path d="M190 190 L125 80 A130 130 0 0 0 60 190 Z" fill="#22c55e" opacity="0.8"/>
    <path d="M190 190 L60 190 A130 130 0 0 0 125 300 Z" fill="#3b82f6" opacity="0.8"/>
    <path d="M190 190 L125 300 A130 130 0 0 0 255 300 Z" fill="#8b5cf6" opacity="0.8"/>
    <path d="M190 190 L255 300 A130 130 0 0 0 320 190 Z" fill="#ec4899" opacity="0.8"/>
    <circle cx="190" cy="190" r="50" fill="#0f172a"/>
    <!-- HEX label -->
    <text x="190" y="196" font-family="monospace" font-size="14" fill="#f1f5f9" text-anchor="middle">#3B82F6</text>`,

  'uuid-generator': `
    <!-- UUID display -->
    <rect x="10" y="100" width="360" height="80" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="30" y="140" font-family="monospace" font-size="14" fill="#60a5fa">550e8400-e29b</text>
    <text x="30" y="162" font-family="monospace" font-size="14" fill="#60a5fa">-41d4-a716-446655</text>
    <!-- Generate button -->
    <rect x="90" y="220" width="180" height="50" rx="10" fill="#3b82f6"/>
    <text x="180" y="251" font-family="monospace" font-size="16" font-weight="bold" fill="white" text-anchor="middle">Generate</text>
    <!-- Random sparks -->
    <path d="M30 290 L50 310 L30 330" stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M310 290 L330 310 L310 330" stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.6"/>
    <circle cx="180" cy="320" r="8" fill="#f59e0b" opacity="0.4"/>
    <circle cx="80" cy="370" r="5" fill="#60a5fa" opacity="0.4"/>
    <circle cx="280" cy="370" r="5" fill="#60a5fa" opacity="0.4"/>`,

  'regex-tester': `
    <!-- Regex expression -->
    <rect x="10" y="40" width="360" height="60" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="76" font-family="monospace" font-size="18" fill="#f59e0b">/</text>
    <text x="42" y="76" font-family="monospace" font-size="17" fill="#f1f5f9">[a-z0-9]+</text>
    <text x="180" y="76" font-family="monospace" font-size="18" fill="#ec4899">@</text>
    <text x="198" y="76" font-family="monospace" font-size="17" fill="#f1f5f9">\w+\.\w+</text>
    <text x="330" y="76" font-family="monospace" font-size="18" fill="#f59e0b">/gi</text>
    <!-- Test string with match highlights -->
    <rect x="10" y="120" width="360" height="80" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="155" font-family="monospace" font-size="14" fill="#94a3b8">Contact </text>
    <rect x="108" y="138" width="88" height="22" rx="4" fill="#f59e0b" opacity="0.3"/>
    <text x="110" y="155" font-family="monospace" font-size="14" fill="#fbbf24">user@test</text>
    <text x="200" y="155" font-family="monospace" font-size="14" fill="#94a3b8">.com</text>
    <!-- Match count -->
    <text x="26" y="190" font-family="monospace" font-size="13" fill="#22c55e">✓ 1 match found</text>
    <!-- Groups -->
    <rect x="10" y="220" width="160" height="100" rx="10" fill="#1e293b" stroke="#22c55e" stroke-width="1"/>
    <text x="26" y="245" font-family="monospace" font-size="12" fill="#4ade80">Group 1:</text>
    <text x="26" y="263" font-family="monospace" font-size="12" fill="#f1f5f9">"user"</text>
    <text x="26" y="285" font-family="monospace" font-size="12" fill="#4ade80">Group 2:</text>
    <text x="26" y="303" font-family="monospace" font-size="12" fill="#f1f5f9">"test.com"</text>`,

  'hash-generator': `
    <!-- Input -->
    <rect x="10" y="60" width="360" height="50" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="91" font-family="monospace" font-size="14" fill="#94a3b8">password123</text>
    <!-- Arrow + SHA-256 label -->
    <text x="100" y="148" font-family="monospace" font-size="13" fill="#8b5cf6">SHA-256</text>
    <path d="M190 122 L190 158" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"/>
    <path d="M178 146 L190 160 L202 146" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Hash output -->
    <rect x="10" y="164" width="360" height="80" rx="10" fill="#1e293b" stroke="#8b5cf6" stroke-width="2"/>
    <text x="26" y="196" font-family="monospace" font-size="12" fill="#a78bfa">ef92b779bfdd9442</text>
    <text x="26" y="214" font-family="monospace" font-size="12" fill="#a78bfa">2a23cc7a4139040e</text>
    <text x="26" y="232" font-family="monospace" font-size="12" fill="#a78bfa">...</text>
    <!-- Hash types -->
    <rect x="10" y="270" width="80" height="30" rx="6" fill="#1e293b" stroke="#334155"/>
    <text x="50" y="290" font-family="monospace" font-size="12" fill="#60a5fa" text-anchor="middle">MD5</text>
    <rect x="100" y="270" width="90" height="30" rx="6" fill="#8b5cf6" opacity="0.8"/>
    <text x="145" y="290" font-family="monospace" font-size="12" fill="white" text-anchor="middle">SHA-256</text>
    <rect x="200" y="270" width="90" height="30" rx="6" fill="#1e293b" stroke="#334155"/>
    <text x="245" y="290" font-family="monospace" font-size="12" fill="#60a5fa" text-anchor="middle">SHA-512</text>`,

  'hash-decoder': `
    <!-- Lock with question mark -->
    <rect x="80" y="160" width="200" height="180" rx="18" fill="#1e293b" stroke="#ef4444" stroke-width="3"/>
    <path d="M110 160 L110 100 Q180 40 250 100 L250 160" stroke="#ef4444" stroke-width="7" fill="none" stroke-linecap="round"/>
    <!-- Question inside -->
    <text x="180" y="265" font-family="system-ui" font-size="52" font-weight="bold" fill="#ef4444" text-anchor="middle">?</text>
    <!-- Hash examples around -->
    <text x="10" y="60" font-family="monospace" font-size="11" fill="#ef4444" opacity="0.5">5f4dcc3b...</text>
    <text x="220" y="80" font-family="monospace" font-size="11" fill="#ef4444" opacity="0.5">482c811d...</text>
    <text x="10" y="350" font-family="monospace" font-size="11" fill="#ef4444" opacity="0.5">e10adc39...</text>`,

  'jwt-encoder': `
    <!-- JWT parts -->
    <rect x="10" y="60" width="110" height="40" rx="8" fill="#ef4444" opacity="0.8"/>
    <text x="65" y="86" font-family="monospace" font-size="13" fill="white" text-anchor="middle">Header</text>
    <text x="135" y="86" font-family="monospace" font-size="18" fill="#334155">.</text>
    <rect x="150" y="60" width="110" height="40" rx="8" fill="#8b5cf6" opacity="0.8"/>
    <text x="205" y="86" font-family="monospace" font-size="13" fill="white" text-anchor="middle">Payload</text>
    <text x="275" y="86" font-family="monospace" font-size="18" fill="#334155">.</text>
    <rect x="290" y="60" width="90" height="40" rx="8" fill="#3b82f6" opacity="0.8"/>
    <text x="335" y="86" font-family="monospace" font-size="12" fill="white" text-anchor="middle">Signature</text>
    <!-- Arrow -->
    <path d="M190 120 L190 155" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
    <path d="M178 143 L190 157 L202 143" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Token output -->
    <rect x="10" y="162" width="360" height="80" rx="10" fill="#1e293b" stroke="#60a5fa" stroke-width="2"/>
    <text x="26" y="192" font-family="monospace" font-size="11" fill="#ef4444">eyJhbGci</text>
    <text x="96" y="192" font-family="monospace" font-size="11" fill="#334155">.</text>
    <text x="104" y="192" font-family="monospace" font-size="11" fill="#a78bfa">eyJzdWIi</text>
    <text x="174" y="192" font-family="monospace" font-size="11" fill="#334155">.</text>
    <text x="182" y="192" font-family="monospace" font-size="11" fill="#60a5fa">SflKxwRJ</text>
    <text x="26" y="212" font-family="monospace" font-size="11" fill="#60a5fa">...encoded...</text>`,

  'jwt-decoder': `
    <!-- Token input -->
    <rect x="10" y="40" width="360" height="60" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="68" font-family="monospace" font-size="11" fill="#ef4444">eyJhbGci.</text>
    <text x="106" y="68" font-family="monospace" font-size="11" fill="#a78bfa">eyJzdWIi.</text>
    <text x="188" y="68" font-family="monospace" font-size="11" fill="#60a5fa">SflKxw</text>
    <text x="26" y="86" font-family="monospace" font-size="11" fill="#64748b">JWT Token</text>
    <!-- Decoded sections -->
    <rect x="10" y="130" width="110" height="120" rx="8" fill="#1e293b" stroke="#ef4444" stroke-width="2"/>
    <text x="65" y="152" font-family="monospace" font-size="12" fill="#ef4444" text-anchor="middle">Header</text>
    <text x="26" y="172" font-family="monospace" font-size="11" fill="#94a3b8">"alg":</text>
    <text x="26" y="190" font-family="monospace" font-size="11" fill="#fbbf24">"HS256"</text>
    <text x="26" y="210" font-family="monospace" font-size="11" fill="#94a3b8">"typ":</text>
    <text x="26" y="228" font-family="monospace" font-size="11" fill="#fbbf24">"JWT"</text>
    <rect x="130" y="130" width="120" height="120" rx="8" fill="#1e293b" stroke="#8b5cf6" stroke-width="2"/>
    <text x="190" y="152" font-family="monospace" font-size="12" fill="#a78bfa" text-anchor="middle">Payload</text>
    <text x="146" y="172" font-family="monospace" font-size="11" fill="#94a3b8">"sub":</text>
    <text x="146" y="190" font-family="monospace" font-size="11" fill="#4ade80">"user_1"</text>
    <text x="146" y="210" font-family="monospace" font-size="11" fill="#94a3b8">"exp":</text>
    <text x="146" y="228" font-family="monospace" font-size="11" fill="#4ade80">1735689600</text>
    <rect x="260" y="130" width="100" height="120" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="310" y="152" font-family="monospace" font-size="11" fill="#60a5fa" text-anchor="middle">Signature</text>
    <text x="276" y="190" font-family="monospace" font-size="28" fill="#60a5fa" text-anchor="middle">✓</text>`,

  'qr-code-generator': `
    <!-- QR code pattern -->
    <rect x="70" y="40" width="230" height="230" rx="12" fill="#f1f5f9"/>
    <!-- Corner squares -->
    <rect x="86" y="56" width="60" height="60" rx="6" fill="#0f172a"/>
    <rect x="94" y="64" width="44" height="44" rx="4" fill="#f1f5f9"/>
    <rect x="102" y="72" width="28" height="28" rx="2" fill="#0f172a"/>
    <rect x="224" y="56" width="60" height="60" rx="6" fill="#0f172a"/>
    <rect x="232" y="64" width="44" height="44" rx="4" fill="#f1f5f9"/>
    <rect x="240" y="72" width="28" height="28" rx="2" fill="#0f172a"/>
    <rect x="86" y="194" width="60" height="60" rx="6" fill="#0f172a"/>
    <rect x="94" y="202" width="44" height="44" rx="4" fill="#f1f5f9"/>
    <rect x="102" y="210" width="28" height="28" rx="2" fill="#0f172a"/>
    <!-- Data modules (simplified) -->
    <rect x="162" y="56" width="52" height="8" rx="2" fill="#0f172a"/>
    <rect x="162" y="72" width="26" height="8" rx="2" fill="#0f172a"/>
    <rect x="196" y="72" width="18" height="8" rx="2" fill="#0f172a"/>
    <rect x="162" y="88" width="52" height="8" rx="2" fill="#0f172a"/>
    <rect x="86" y="130" width="26" height="8" rx="2" fill="#0f172a"/>
    <rect x="120" y="130" width="18" height="8" rx="2" fill="#0f172a"/>
    <rect x="162" y="130" width="52" height="8" rx="2" fill="#0f172a"/>
    <rect x="86" y="148" width="44" height="8" rx="2" fill="#0f172a"/>
    <rect x="162" y="148" width="26" height="8" rx="2" fill="#0f172a"/>
    <rect x="196" y="148" width="18" height="8" rx="2" fill="#0f172a"/>
    <!-- URL below -->
    <text x="185" y="310" font-family="monospace" font-size="13" fill="#60a5fa" text-anchor="middle">https://anivaryam.github.io</text>`,

  'timestamp-converter': `
    <!-- Clock face -->
    <circle cx="190" cy="170" r="130" fill="#1e293b" stroke="#334155" stroke-width="3"/>
    <circle cx="190" cy="170" r="120" fill="#0f172a"/>
    <!-- Clock markings -->
    <line x1="190" y1="58" x2="190" y2="78" stroke="#334155" stroke-width="3"/>
    <line x1="190" y1="262" x2="190" y2="282" stroke="#334155" stroke-width="3"/>
    <line x1="78" y1="170" x2="98" y2="170" stroke="#334155" stroke-width="3"/>
    <line x1="282" y1="170" x2="302" y2="170" stroke="#334155" stroke-width="3"/>
    <!-- Clock hands -->
    <line x1="190" y1="170" x2="190" y2="100" stroke="#f1f5f9" stroke-width="4" stroke-linecap="round"/>
    <line x1="190" y1="170" x2="240" y2="200" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
    <circle cx="190" cy="170" r="8" fill="#3b82f6"/>
    <!-- Unix timestamp -->
    <rect x="30" y="330" width="300" height="40" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="180" y="356" font-family="monospace" font-size="15" fill="#60a5fa" text-anchor="middle">1735689600</text>`,

  'csv-to-json': `
    <!-- CSV table -->
    <rect x="10" y="40" width="160" height="180" rx="8" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <line x1="10" y1="68" x2="170" y2="68" stroke="#334155" stroke-width="1"/>
    <text x="26" y="60" font-family="monospace" font-size="12" fill="#f59e0b">name,age</text>
    <text x="26" y="90" font-family="monospace" font-size="12" fill="#94a3b8">Alice,30</text>
    <text x="26" y="110" font-family="monospace" font-size="12" fill="#94a3b8">Bob,25</text>
    <text x="26" y="130" font-family="monospace" font-size="12" fill="#94a3b8">Carol,28</text>
    <!-- Arrow -->
    <path d="M182 130 L222 130" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
    <path d="M210 118 L224 130 L210 142" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- JSON output -->
    <rect x="230" y="40" width="150" height="220" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="246" y="68" font-family="monospace" font-size="12" fill="#60a5fa">[{</text>
    <text x="256" y="88" font-family="monospace" font-size="11" fill="#34d399">"name":</text>
    <text x="256" y="106" font-family="monospace" font-size="11" fill="#fbbf24">"Alice",</text>
    <text x="256" y="124" font-family="monospace" font-size="11" fill="#34d399">"age":</text>
    <text x="256" y="142" font-family="monospace" font-size="11" fill="#fbbf24">30</text>
    <text x="246" y="162" font-family="monospace" font-size="12" fill="#60a5fa">},{</text>
    <text x="256" y="182" font-family="monospace" font-size="11" fill="#34d399">"name":</text>
    <text x="256" y="200" font-family="monospace" font-size="11" fill="#fbbf24">"Bob"</text>
    <text x="246" y="220" font-family="monospace" font-size="12" fill="#60a5fa">}]</text>`,

  'text-diff': `
    <!-- Left text (old) -->
    <rect x="10" y="60" width="160" height="200" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="90" font-family="monospace" font-size="13" fill="#94a3b8">Hello world.</text>
    <rect x="26" y="100" width="140" height="22" rx="4" fill="#ef4444" opacity="0.2"/>
    <text x="26" y="116" font-family="monospace" font-size="13" fill="#ef4444">Old line here</text>
    <text x="26" y="140" font-family="monospace" font-size="13" fill="#94a3b8">Unchanged.</text>
    <text x="26" y="162" font-family="monospace" font-size="13" fill="#94a3b8">More text.</text>
    <!-- Diff arrow -->
    <text x="183" y="168" font-family="monospace" font-size="28" fill="#60a5fa">⟷</text>
    <!-- Right text (new) -->
    <rect x="210" y="60" width="160" height="200" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="226" y="90" font-family="monospace" font-size="13" fill="#94a3b8">Hello world.</text>
    <rect x="226" y="100" width="140" height="22" rx="4" fill="#22c55e" opacity="0.2"/>
    <text x="226" y="116" font-family="monospace" font-size="13" fill="#4ade80">New line here</text>
    <text x="226" y="140" font-family="monospace" font-size="13" fill="#94a3b8">Unchanged.</text>
    <text x="226" y="162" font-family="monospace" font-size="13" fill="#94a3b8">More text.</text>`,

  'image-tool': `
    <!-- Image frame -->
    <rect x="20" y="40" width="200" height="160" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <!-- Landscape inside -->
    <rect x="30" y="50" width="180" height="140" rx="8" fill="#0f172a"/>
    <circle cx="60" cy="80" r="16" fill="#f59e0b" opacity="0.6"/>
    <path d="M30 160 Q80 120 130 140 Q170 155 210 130 L210 190 L30 190Z" fill="#22c55e" opacity="0.3"/>
    <!-- Arrow compress -->
    <path d="M230 120 L280 120" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
    <path d="M268 108 L282 120 L268 132" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Compressed output -->
    <rect x="290" y="70" width="80" height="100" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
    <text x="330" y="120" font-family="monospace" font-size="11" fill="#60a5fa" text-anchor="middle">75%</text>
    <text x="330" y="138" font-family="monospace" font-size="10" fill="#94a3b8" text-anchor="middle">smaller</text>
    <!-- Size labels -->
    <text x="120" y="220" font-family="monospace" font-size="13" fill="#94a3b8" text-anchor="middle">2.4 MB</text>
    <text x="330" y="190" font-family="monospace" font-size="13" fill="#60a5fa" text-anchor="middle">620 KB</text>`,

  'json-extractor': `
    <!-- JSON input -->
    <rect x="10" y="30" width="200" height="220" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>
    <text x="26" y="60" font-family="monospace" font-size="13" fill="#60a5fa">{</text>
    <text x="42" y="82" font-family="monospace" font-size="12" fill="#34d399">"user"</text>
    <text x="102" y="82" font-family="monospace" font-size="12" fill="#60a5fa">: {</text>
    <text x="58" y="102" font-family="monospace" font-size="12" fill="#34d399">"name"</text>
    <text x="118" y="102" font-family="monospace" font-size="12" fill="#fbbf24">: "Kim"</text>
    <text x="58" y="122" font-family="monospace" font-size="12" fill="#34d399">"role"</text>
    <text x="110" y="122" font-family="monospace" font-size="12" fill="#fbbf24">: "dev"</text>
    <text x="42" y="142" font-family="monospace" font-size="12" fill="#60a5fa">},</text>
    <text x="42" y="164" font-family="monospace" font-size="12" fill="#34d399">"status"</text>
    <text x="122" y="164" font-family="monospace" font-size="12" fill="#fbbf24">: "ok"</text>
    <text x="26" y="184" font-family="monospace" font-size="13" fill="#60a5fa">}</text>
    <!-- Path selector -->
    <rect x="10" y="268" width="200" height="36" rx="8" fill="#0f172a" stroke="#8b5cf6" stroke-width="2"/>
    <text x="26" y="291" font-family="monospace" font-size="13" fill="#a78bfa">user.name</text>
    <!-- Arrow -->
    <path d="M222 160 L262 160" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>
    <path d="M250 148 L264 160 L250 172" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- Extracted -->
    <rect x="270" y="130" width="100" height="60" rx="8" fill="#1e293b" stroke="#8b5cf6" stroke-width="2"/>
    <text x="320" y="165" font-family="monospace" font-size="16" fill="#a78bfa" text-anchor="middle">"Kim"</text>`,
};

// Blog post definitions
const posts = [
  {
    file: 'word-to-html.svg',
    name: 'Word to HTML Converter',
    category: 'Tutorial',
    tagline: 'Convert Word documents to clean, SEO-ready HTML without the mess.',
    accent: '#3b82f6',
    icon: icons['word-to-html'],
  },
  {
    file: 'web-scraper.svg',
    name: 'Web Scraper Tool',
    category: 'Tutorial',
    tagline: 'Extract structured data from any website using CSS selectors.',
    accent: '#10b981',
    icon: icons['web-scraper'],
  },
  {
    file: 'random-universe-cipher.svg',
    name: 'Random Universe Cipher',
    category: 'Security',
    tagline: '256-bit post-quantum symmetric cipher with Argon2id key derivation.',
    accent: '#8b5cf6',
    icon: icons['random-universe-cipher'],
  },
  {
    file: 'json-formatter.svg',
    name: 'JSON Formatter & Validator',
    category: 'Tool',
    tagline: 'Format, validate, and minify JSON with syntax highlighting.',
    accent: '#3b82f6',
    icon: icons['json-formatter'],
  },
  {
    file: 'base64.svg',
    name: 'Base64 Encoder & Decoder',
    category: 'Tool',
    tagline: 'Encode text or files to Base64 and decode Base64 strings instantly.',
    accent: '#f59e0b',
    icon: icons['base64'],
  },
  {
    file: 'url-encoder.svg',
    name: 'URL Encoder & Decoder',
    category: 'Tool',
    tagline: 'Encode and decode URL components for safe use in web addresses.',
    accent: '#3b82f6',
    icon: icons['url-encoder'],
  },
  {
    file: 'color-converter.svg',
    name: 'Color Converter',
    category: 'Tool',
    tagline: 'Convert colors between HEX, RGB, HSL, and more formats.',
    accent: '#ec4899',
    icon: icons['color-converter'],
  },
  {
    file: 'uuid-generator.svg',
    name: 'UUID Generator',
    category: 'Tool',
    tagline: 'Generate RFC-4122 UUIDs v1, v3, v4, and v5 in bulk.',
    accent: '#f59e0b',
    icon: icons['uuid-generator'],
  },
  {
    file: 'regex-tester.svg',
    name: 'Regex Tester',
    category: 'Tool',
    tagline: 'Test regular expressions with live match highlighting and capture groups.',
    accent: '#f59e0b',
    icon: icons['regex-tester'],
  },
  {
    file: 'hash-generator.svg',
    name: 'Hash Generator',
    category: 'Security',
    tagline: 'Generate MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes.',
    accent: '#8b5cf6',
    icon: icons['hash-generator'],
  },
  {
    file: 'hash-decoder.svg',
    name: 'Hash Decoder / Lookup',
    category: 'Security',
    tagline: 'Reverse lookup common hash values using dictionary databases.',
    accent: '#ef4444',
    icon: icons['hash-decoder'],
  },
  {
    file: 'jwt-encoder.svg',
    name: 'JWT Encoder',
    category: 'Security',
    tagline: 'Build and sign JSON Web Tokens with header, payload, and secret.',
    accent: '#3b82f6',
    icon: icons['jwt-encoder'],
  },
  {
    file: 'jwt-decoder.svg',
    name: 'JWT Decoder',
    category: 'Security',
    tagline: 'Decode and inspect JWT token claims, header, and signature.',
    accent: '#3b82f6',
    icon: icons['jwt-decoder'],
  },
  {
    file: 'qr-code-generator.svg',
    name: 'QR Code Generator',
    category: 'Tool',
    tagline: 'Generate customizable QR codes for URLs, text, contacts, and more.',
    accent: '#0f172a',
    icon: icons['qr-code-generator'],
  },
  {
    file: 'timestamp-converter.svg',
    name: 'Timestamp Converter',
    category: 'Tool',
    tagline: 'Convert Unix timestamps to human-readable dates and back.',
    accent: '#3b82f6',
    icon: icons['timestamp-converter'],
  },
  {
    file: 'csv-to-json.svg',
    name: 'CSV to JSON Converter',
    category: 'Tool',
    tagline: 'Convert CSV files and tables to structured JSON instantly.',
    accent: '#3b82f6',
    icon: icons['csv-to-json'],
  },
  {
    file: 'text-diff.svg',
    name: 'Text Diff Tool',
    category: 'Tool',
    tagline: 'Compare two blocks of text and see exactly what changed.',
    accent: '#22c55e',
    icon: icons['text-diff'],
  },
  {
    file: 'image-tool.svg',
    name: 'Image Compression Tool',
    category: 'Tool',
    tagline: 'Compress, resize, and convert images entirely in the browser.',
    accent: '#3b82f6',
    icon: icons['image-tool'],
  },
  {
    file: 'json-extractor.svg',
    name: 'JSON Data Extractor',
    category: 'Tool',
    tagline: 'Extract specific fields from nested JSON using dot-path syntax.',
    accent: '#8b5cf6',
    icon: icons['json-extractor'],
  },
];

let generated = 0;
for (const post of posts) {
  const svg = makeSvg(post);
  const outPath = path.join(outDir, post.file);
  fs.writeFileSync(outPath, svg, 'utf-8');
  generated++;
  console.log(`✅ ${post.file}`);
}

console.log(`\nGenerated ${generated} blog cover images in ${outDir}`);
