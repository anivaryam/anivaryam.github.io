export function isPrivateHost(input: string): boolean {
  const host = input.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host.endsWith(".test")
  ) return true;

  if (host.includes(":")) {
    const firstHextet = Number.parseInt(host.split(":")[0] || "0", 16);
    return host === "::"
      || host === "::1"
      || !Number.isFinite(firstHextet)
      || firstHextet < 0x2000
      || firstHextet > 0x3fff
      || /^2001:db8(?::|$)/.test(host);
  }

  const octets = host.split(".");
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const [a, b] = octets.map(Number);
  if (octets.some((part) => Number(part) > 255)) return true;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}
