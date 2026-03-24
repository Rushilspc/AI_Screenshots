export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_#.+-]+/g)
    .filter((token) => token.length >= 2);
}

export function buildHashEmbedding(text: string, dimensions = 384): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const token of tokenize(text)) {
    const index = hashToken(token) % dimensions;
    const sign = (hashToken(`sign:${token}`) & 1) === 0 ? 1 : -1;
    vector[index] += sign * (1 + Math.min(token.length, 12) / 12);
  }
  return l2Normalize(vector);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function toFtsQuery(query: string): string {
  const terms = tokenize(query).slice(0, 8);
  if (terms.length === 0) return "";
  return terms.map((term) => `${escapeFts(term)}*`).join(" OR ");
}

function l2Normalize(vec: number[]): number[] {
  let mag = 0;
  for (const v of vec) mag += v * v;
  if (mag === 0) return vec;
  const scale = 1 / Math.sqrt(mag);
  return vec.map((v) => v * scale);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeFts(term: string): string {
  return term.replace(/"/g, '""');
}
