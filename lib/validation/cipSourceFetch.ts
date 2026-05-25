// Assisted CIP Source Import — server-side metadata fetch.
//
// SAFETY BOUNDARY (read me before changing this file):
//   This helper fetches *source metadata* for a published CIP / Shooters
//   World reference URL. It does NOT extract Pmax / chamber-volume / rifling
//   numbers from the document body, and it does NOT compute, predict, or
//   recommend chamber pressure, charges, increases / decreases, or
//   safe/unsafe verdicts. Any numeric fields on a draft record must be
//   transcribed by a human admin from the cited source.
//
// Scope of what this returns:
//   - canonical (validated) URL
//   - host / domain
//   - whether the host is a recognised CIP domain
//   - HTTP status, content-type, content-length, last-modified
//   - an HTML <title> if (and only if) the response is HTML and small enough
//   - a best-effort PDF filename from the URL path or Content-Disposition
//
// What it deliberately does NOT do:
//   - download or parse PDF bodies
//   - extract Pmax / volume / rifling values from any document
//   - follow arbitrary cross-origin redirects without re-checking the host
//   - run on the client; this is a node-runtime module only

export const CIP_KNOWN_HOSTS = [
  'cip-bobp.org',
  'bobp.cip-bobp.org',
  'cip-bob.org',
  'www.cip-bobp.org',
  'www.cip-bob.org',
] as const;

export type CipKnownHost = (typeof CIP_KNOWN_HOSTS)[number];

export type CipSourceFetchResult = {
  ok: boolean;
  // Echoed back so the UI can display what was actually fetched.
  url: string;
  host: string | null;
  // True if `host` ends with one of CIP_KNOWN_HOSTS. We do NOT block
  // non-CIP hosts at the fetch layer — the API route surfaces a warning
  // and refuses to auto-create a draft. The admin can still type metadata
  // in manually if they trust the source.
  isKnownCipHost: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: number | null;
  lastModified: string | null;
  // Detected from the URL path or Content-Disposition; null when not a PDF.
  pdfFilename: string | null;
  // HTML <title>, only set when the response was HTML and small enough to
  // sniff safely. Truncated to 200 chars.
  htmlTitle: string | null;
  // Human-readable warnings: unknown host, fetch error, content type, etc.
  warnings: string[];
  // ISO timestamp of the fetch attempt.
  fetchedAt: string;
  // Set when fetch threw (DNS error, network refused, etc.). The UI shows
  // this and still allows the admin to create a draft from the URL only.
  errorMessage: string | null;
};

const MAX_HTML_SNIFF_BYTES = 64 * 1024; // 64 KiB
const FETCH_TIMEOUT_MS = 8_000;

export function isKnownCipHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return CIP_KNOWN_HOSTS.some((known) => h === known || h.endsWith('.' + known));
}

export function looksLikePdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return false;
  }
}

function filenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (!last) return null;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  } catch {
    return null;
  }
}

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;
  // RFC 5987 filename* first
  const star = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(value);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(value);
  if (plain) return plain[1].trim();
  return null;
}

function extractTitle(html: string): string | null {
  // Cheap regex extract — we intentionally avoid an HTML parser. We only
  // want a label for display; we never derive pressure values from the body.
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const text = m[1]
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  if (!text) return null;
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

export function validateAndNormalizeUrl(
  raw: string,
): { ok: true; url: string; host: string } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'Source URL is required.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'Source URL is required.' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Source URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Source URL must use http or https.' };
  }
  // Reject obvious SSRF targets. We never call internal addresses.
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: 'Source URL host is not allowed.' };
  }
  return { ok: true, url: parsed.toString(), host };
}

// Server-side fetch. Designed to never throw — always returns a
// CipSourceFetchResult with warnings / errorMessage populated when something
// went wrong. The caller decides whether to surface the warnings, but it
// MUST NOT auto-promote a draft to VERIFIED based on this output.
export async function fetchCipSourceMetadata(
  rawUrl: string,
): Promise<CipSourceFetchResult> {
  const fetchedAt = new Date().toISOString();
  const validated = validateAndNormalizeUrl(rawUrl);
  if (!validated.ok) {
    return {
      ok: false,
      url: rawUrl,
      host: null,
      isKnownCipHost: false,
      status: null,
      contentType: null,
      contentLength: null,
      lastModified: null,
      pdfFilename: null,
      htmlTitle: null,
      warnings: [],
      fetchedAt,
      errorMessage: validated.reason,
    };
  }

  const url = validated.url;
  const host = validated.host;
  const knownHost = isKnownCipHost(host);
  const warnings: string[] = [];
  if (!knownHost) {
    warnings.push(
      `Host "${host}" is not in the known CIP allow-list (${CIP_KNOWN_HOSTS.join(', ')}). ` +
        'Verify this is an official CIP source before saving.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // Polite UA so an admin can see this hit their server logs if they
        // own the source.
        'User-Agent': 'LoadBenchPro-AssistedCipImport/1.0 (+admin-fetch)',
        Accept:
          'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5',
      },
    });
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      url,
      host,
      isKnownCipHost: knownHost,
      status: null,
      contentType: null,
      contentLength: null,
      lastModified: null,
      pdfFilename: looksLikePdfUrl(url) ? filenameFromUrl(url) : null,
      htmlTitle: null,
      warnings,
      fetchedAt,
      errorMessage:
        e instanceof Error
          ? `Fetch failed: ${e.message}`
          : 'Fetch failed: unknown network error.',
    };
  }
  clearTimeout(timer);

  const status = response.status;
  const contentType = response.headers.get('content-type');
  const contentLengthRaw = response.headers.get('content-length');
  const contentLength = contentLengthRaw ? Number(contentLengthRaw) : null;
  const lastModified = response.headers.get('last-modified');
  const contentDisposition = response.headers.get('content-disposition');

  if (status < 200 || status >= 400) {
    warnings.push(`HTTP ${status} returned by source.`);
  }

  let pdfFilename: string | null = null;
  if (
    (contentType ?? '').toLowerCase().includes('application/pdf') ||
    looksLikePdfUrl(url)
  ) {
    pdfFilename =
      filenameFromContentDisposition(contentDisposition) ??
      filenameFromUrl(url);
    warnings.push(
      'Source is a PDF. The app does not parse PDF bodies — Pmax, ' +
        'volume, and rifling values must be transcribed manually.',
    );
  }

  let htmlTitle: string | null = null;
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    try {
      // Read a small prefix only. The body reader is bounded so a hostile
      // server can't OOM us with a multi-GB response.
      const reader = response.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let total = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
          if (total >= MAX_HTML_SNIFF_BYTES) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            break;
          }
        }
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        const text = new TextDecoder('utf-8', { fatal: false }).decode(merged);
        htmlTitle = extractTitle(text);
      }
    } catch (e) {
      warnings.push(
        `Could not read HTML body for title: ${
          e instanceof Error ? e.message : 'unknown error'
        }`,
      );
    }
  }

  return {
    ok: status >= 200 && status < 400,
    url,
    host,
    isKnownCipHost: knownHost,
    status,
    contentType,
    contentLength: Number.isFinite(contentLength) ? contentLength : null,
    lastModified,
    pdfFilename,
    htmlTitle,
    warnings,
    fetchedAt,
    errorMessage: null,
  };
}

// Build a default sourceLabel from the fetch result. Used by the
// "create draft from URL" flow when the admin did not type one in.
export function deriveSourceLabel(meta: CipSourceFetchResult): string | null {
  if (meta.htmlTitle) return meta.htmlTitle;
  if (meta.pdfFilename) return meta.pdfFilename;
  const fromUrl = filenameFromUrl(meta.url);
  return fromUrl ?? null;
}

// Build a default sourceDate from Last-Modified if it parses. Returns null
// when the header was missing or unparseable — the admin can fill it in.
export function deriveSourceDate(meta: CipSourceFetchResult): Date | null {
  if (!meta.lastModified) return null;
  const t = Date.parse(meta.lastModified);
  return Number.isFinite(t) ? new Date(t) : null;
}
