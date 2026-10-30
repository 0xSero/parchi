// Private-network destination guard for agent browser tools (issue #42).
// Agent-driven tools must not reach loopback / LAN / link-local / intranet hosts or local files unless the user
// explicitly approved that host, otherwise a prompt-injected task can read victim-only endpoints and exfiltrate them.

const PRIVATE_HOST_SUFFIXES = [
  'localhost',
  'local',
  'localdomain',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'private',
  'home.arpa',
  'test',
];

// Public wildcard-DNS services that resolve embedded addresses (e.g. 127.0.0.1.nip.io) to private IPs.
const LOOPBACK_DNS_SUFFIXES = ['nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me', 'vcap.me', 'traefik.me'];

const HOST_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:']);

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPrivateIpv4([a, b, c]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function parseIpv6(host: string): number[] | null {
  if (!host.includes(':')) return null;
  const [head, tail, ...rest] = host.split('::');
  if (rest.length) return null;
  const toHextets = (chunk: string | undefined) => {
    if (!chunk) return [] as number[];
    const out: number[] = [];
    for (const piece of chunk.split(':')) {
      const v4 = piece.includes('.') ? parseIpv4(piece) : null;
      if (v4) out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      else if (/^[0-9a-f]{1,4}$/.test(piece)) out.push(Number.parseInt(piece, 16));
      else return null;
    }
    return out;
  };
  const left = toHextets(head);
  const right = tail === undefined ? [] : toHextets(tail);
  if (!left || !right) return null;
  const fill = 8 - left.length - right.length;
  if (tail === undefined ? fill !== 0 : fill < 0) return null;
  return [...left, ...new Array(fill).fill(0), ...right];
}

function isPrivateIpv6(h: number[]): boolean {
  const embeddedV4 = [h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff];
  const upperZero = h.slice(0, 5).every((x) => x === 0);
  if (upperZero && (h[5] === 0 || h[5] === 0xffff)) {
    // ::, ::1, IPv4-compatible and IPv4-mapped (::ffff:a.b.c.d) addresses.
    if (h[5] === 0 && h[6] === 0 && h[7] <= 1) return true;
    return isPrivateIpv4(embeddedV4);
  }
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isPrivateIpv4(embeddedV4); // NAT64 well-known prefix
  }
  return (h[0] & 0xfe00) === 0xfc00 || (h[0] & 0xffc0) === 0xfe80 || (h[0] & 0xffc0) === 0xfec0 || h[0] >= 0xff00;
}

/** Normalize a URL hostname: lowercase, drop IPv6 brackets and trailing dots. */
function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
}

function matchesSuffix(host: string, suffixes: string[]) {
  return suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** True for a literal IPv4/IPv6 address (as reported by webRequest/CDP) in loopback, LAN, link-local or similar space. */
export function isPrivateIpAddress(ip: string): boolean {
  const host = normalizeHostname(ip).split('%')[0];
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);
  const v6 = parseIpv6(host);
  return v6 ? isPrivateIpv6(v6) : false;
}

/** True when a hostname (already WHATWG-normalized) targets loopback, LAN, link-local or intranet space. */
export function isPrivateHostname(rawHostname: string): boolean {
  const host = normalizeHostname(rawHostname);
  if (!host) return true;
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);
  const v6 = parseIpv6(host);
  if (v6) return isPrivateIpv6(v6);
  if (!host.includes('.')) return true; // single-label names resolve via LAN search domains
  return matchesSuffix(host, PRIVATE_HOST_SUFFIXES) || matchesSuffix(host, LOOPBACK_DNS_SUFFIXES);
}

/**
 * True when the URL points at a private destination. The WHATWG URL parser already canonicalizes
 * decimal/octal/hex IPv4 forms, userinfo tricks (a@127.0.0.1) and IDN digits before we classify.
 */
export function isPrivateNetworkUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'file:') return true;
  if (parsed.protocol === 'blob:') return isPrivateNetworkUrl(parsed.pathname);
  if (!HOST_SCHEMES.has(parsed.protocol)) return false;
  return isPrivateHostname(parsed.hostname);
}

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
  'ws:': '80',
  'wss:': '443',
  'ftp:': '21',
};

/** Port written in an approval entry, including default ports that WHATWG URL parsing normalizes away. */
function explicitPort(entry: string) {
  const authority = entry
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/^.*@/, '');
  const match = (authority.startsWith('[') ? authority.slice(authority.indexOf(']') + 1) : authority).match(
    /^[^:]*:(\d+)$|^:(\d+)$/,
  );
  const digits = match?.[1] ?? match?.[2];
  return digits === undefined ? '' : String(Number(digits));
}

function parseApprovalEntry(entry: string) {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === '*') return { any: true, hostname: '', port: '' };
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
    // An entry without a port approves every port of that host; an explicit port (even :80/:443) approves only it.
    return { any: false, hostname: normalizeHostname(parsed.hostname), port: explicitPort(trimmed) };
  } catch {
    return null;
  }
}

/**
 * True when the user explicitly approved this private destination. Entries are host names or IPs with an optional
 * port (localhost, localhost:3000, localhost:80, 192.168.1.10, nas.lan); an explicit port, including a default one,
 * approves only that port. A bare `*` approves every private destination.
 * Named entries also cover their subdomains; IP entries must match exactly.
 */
export function isPrivateUrlApproved(url: string, approvals: string[]): boolean {
  if (!approvals.length) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const entries = approvals.map(parseApprovalEntry).filter((entry) => entry !== null);
  if (entries.some((entry) => entry.any)) return true;
  if (parsed.protocol === 'blob:') return isPrivateUrlApproved(parsed.pathname, approvals);
  if (!HOST_SCHEMES.has(parsed.protocol)) return false;
  const host = normalizeHostname(parsed.hostname);
  const isIp = Boolean(parseIpv4(host) || parseIpv6(host));
  return entries.some((entry) => {
    if (entry.port && entry.port !== (parsed.port || DEFAULT_PORTS[parsed.protocol])) return false;
    if (host === entry.hostname) return true;
    return !isIp && Boolean(entry.hostname) && host.endsWith(`.${entry.hostname}`);
  });
}
