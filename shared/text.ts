// Small text utilities shared by browser and Node.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Convert job-board HTML into readable plain text with paragraph and bullet breaks. */
export function htmlToText(html: string): string {
  let s = decodeEntities(html || '');
  s = s
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|li|section|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l, i, arr) => l.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .trim();
}

export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-phrase test that tolerates punctuation boundaries (works for "c#", "power bi"). */
export function hasPhrase(haystackNorm: string, phraseNorm: string): boolean {
  if (!phraseNorm) return false;
  const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegex(phraseNorm)}($|[^a-z0-9+#])`);
  return re.test(haystackNorm);
}

/** Deterministic 32-bit FNV-1a hash, hex. Good enough for ids and change detection. */
export function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x5bd1e995) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
