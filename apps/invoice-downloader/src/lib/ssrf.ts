import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const lookup = promisify(dns.lookup);

/**
 * Validates a URL to prevent SSRF attacks.
 * Checks protocol and resolves hostname to ensure it doesn't point to private/reserved IP ranges.
 */
export async function isValidUrl(urlString: string): Promise<boolean> {
    try {
        const url = new URL(urlString);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        // Remove brackets from IPv6 literals for lookup
        let hostname = url.hostname;
        if (hostname.startsWith('[') && hostname.endsWith(']')) {
            hostname = hostname.slice(1, -1);
        }

        const { address } = await lookup(hostname);

        if (!address) return false;

        return isPublicIp(address);
    } catch (error) {
        // invalid URL or DNS lookup failed
        return false;
    }
}

function isPublicIp(ip: string): boolean {
    const family = net.isIP(ip);
    if (family === 4) {
        return isPublicIPv4(ip);
    } else if (family === 6) {
        return isPublicIPv6(ip);
    }
    return false;
}

function isPublicIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    const [a, b, c, d] = parts;

    // 0.0.0.0/8
    if (a === 0) return false;
    // 10.0.0.0/8
    if (a === 10) return false;
    // 100.64.0.0/10 (Carrier Grade NAT)
    if (a === 100 && (b >= 64 && b <= 127)) return false;
    // 127.0.0.0/8
    if (a === 127) return false;
    // 169.254.0.0/16
    if (a === 169 && b === 254) return false;
    // 172.16.0.0/12
    if (a === 172 && (b >= 16 && b <= 31)) return false;
    // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 0) return false;
    // 192.0.2.0/24
    if (a === 192 && b === 0 && c === 2) return false;
    // 192.88.99.0/24
    if (a === 192 && b === 88 && c === 99) return false;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return false;
    // 198.18.0.0/15
    if (a === 198 && (b >= 18 && b <= 19)) return false;
    // 198.51.100.0/24
    if (a === 198 && b === 51 && c === 100) return false;
    // 203.0.113.0/24
    if (a === 203 && b === 0 && c === 113) return false;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return false;
    // 240.0.0.0/4 (Reserved)
    if (a >= 240) return false;
    // 255.255.255.255/32 (Broadcast)
    if (a === 255 && b === 255 && c === 255 && d === 255) return false;

    return true;
}

function isPublicIPv6(ip: string): boolean {
    // Check for IPv4-mapped IPv6 addresses (::ffff:192.168.1.1)
    if (ip.toLowerCase().startsWith('::ffff:')) {
        const ipv4Part = ip.substring(7);
        // If it's in dotted decimal notation
        if (ipv4Part.includes('.')) {
            return isPublicIPv4(ipv4Part);
        }
        // If it's in hex (e.g., ::ffff:c0a8:0101), we need to handle it or block it.
        // For safety, if it looks like IPv4-mapped but not dotted decimal, we can try to parse or just block if unsure.
        // But usually dns.lookup returns dotted decimal for the mapped part.
        // Let's implement hex parsing for mapped addresses just in case.
        if (ipv4Part.includes(':')) {
             const parts = ipv4Part.split(':');
             if (parts.length === 2) {
                 const high = parseInt(parts[0], 16);
                 const low = parseInt(parts[1], 16);
                 const p1 = (high >> 8) & 0xFF;
                 const p2 = high & 0xFF;
                 const p3 = (low >> 8) & 0xFF;
                 const p4 = low & 0xFF;
                 return isPublicIPv4(`${p1}.${p2}.${p3}.${p4}`);
             }
        }
    }

    // Normalize IP (simple check)
    // Simple check for loopback
    if (ip === '::1') return false;
    if (ip === '::') return false;

    // Link local fe80::/10
    if (ip.toLowerCase().startsWith('fe8')) return false;
    if (ip.toLowerCase().startsWith('fe9')) return false;
    if (ip.toLowerCase().startsWith('fea')) return false;
    if (ip.toLowerCase().startsWith('feb')) return false;

    // Unique local fc00::/7
    if (ip.toLowerCase().startsWith('fc')) return false;
    if (ip.toLowerCase().startsWith('fd')) return false;

    // Multicast ff00::/8
    if (ip.toLowerCase().startsWith('ff')) return false;

    // IPv4-mapped check again for robustness (e.g. at the end of a long string)
    if (ip.includes('.')) {
         const lastColon = ip.lastIndexOf(':');
         if (lastColon !== -1) {
            const ipv4Part = ip.substring(lastColon + 1);
            return isPublicIPv4(ipv4Part);
         }
    }

    return true;
}
