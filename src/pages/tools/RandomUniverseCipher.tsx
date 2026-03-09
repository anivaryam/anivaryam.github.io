import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Lock, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RandomUniverseCipherTool } from "@/components/tools/RandomUniverseCipherTool";

export default function RandomUniverseCipher() {

  return (
    <Layout>
      <SEO
        title="Random Universe Cipher - Encryption Tool"
        description="256-bit quantum-resistant symmetric encryption cipher. Encrypt and decrypt text and files with password-based authentication. Features AEAD, Argon2 KDF, and SHAKE256. Free online encryption tool."
        canonical="https://anivaryam.github.io/tools/random-universe-cipher"
breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Random Universe Cipher", url: "https://anivaryam.github.io/tools/random-universe-cipher" },
        ]}
        structuredData={{
          type: "SoftwareApplication",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web Browser",
          offers: {
            price: "0",
            priceCurrency: "USD",
          },
        }}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Update Notification */}
        <UpdateNotification />
        
        {/* Breadcrumb */}
        <Breadcrumb className="mb-8">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/tools">Tools</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Random Universe Cipher</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Random Universe Cipher
          </h1>
        </div>

        {/* Cipher Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card/50 border border-border rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Key Size</div>
            <div className="text-lg font-bold">512-bit</div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Block Size</div>
            <div className="text-lg font-bold">256-bit</div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Rounds</div>
            <div className="text-lg font-bold">24</div>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">Security</div>
            <div className="text-lg font-bold">Quantum-Resistant</div>
          </div>
        </div>
      </div>


      {/* Tool - WASM-Accelerated Cipher */}
      <div className="container mx-auto px-4">
        <RandomUniverseCipherTool />
      </div>

      {/* Info Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="p-6 bg-card/50 border border-border rounded-lg">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5" />
            About Random Universe Cipher
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Encrypt and decrypt text and files with this 256-bit quantum-resistant symmetric encryption cipher. Features password-based authentication, AEAD (Authenticated Encryption with Associated Data), Argon2 key derivation function, and SHAKE256 for post-quantum security.
            </p>
            <p>
              Designed for security-conscious users who need post-quantum encryption. The Random Universe Cipher provides strong protection against both classical and quantum computing attacks. All encryption and decryption happens entirely in your browser using WebAssembly—your data never leaves your device, ensuring maximum privacy and security.
            </p>
            <p>
              The Random Universe Cipher (RUC) is a symmetric block cipher designed for post-quantum security.
              It provides 256-bit quantum-resistant security using 512-bit keys.
            </p>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Key Features:</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>7 × 512-bit state registers with GF(2⁸) operations</li>
                <li>24 rounds with key-derived S-boxes</li>
                <li>SHAKE256 keystream generation</li>
                <li>ChaCha20 PRNG for selector permutation</li>
                <li>AEAD (HMAC-SHA256) for authenticated encryption</li>
                <li>Argon2id key derivation function (KDF)</li>
                <li>File encryption support</li>
              </ul>
            </div>
            <p className="pt-2 border-t border-border">
              <strong className="text-warning">⚠️ Note:</strong> This is a demonstration implementation. 
              The cipher has not been audited for production use. Use at your own risk.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

