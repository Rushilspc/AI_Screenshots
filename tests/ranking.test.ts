import { buildHashEmbedding, cosineSimilarity, toFtsQuery, tokenize } from "../src/main/ranking";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testTokenize(): void {
  const tokens = tokenize("React error: cannot read property user_id in app.tsx");
  assert(tokens.includes("react"), "tokenize should include react");
  assert(tokens.includes("error"), "tokenize should include error");
  assert(tokens.includes("user_id"), "tokenize should preserve underscore tokens");
}

function testEmbeddingSimilarity(): void {
  const a = buildHashEmbedding("react hook useeffect dependency warning");
  const b = buildHashEmbedding("react useeffect warning about dependency array");
  const c = buildHashEmbedding("invoice payment amount tax receipt");

  assert(a.length === 384, "embedding dimension should be 384");
  assert(cosineSimilarity(a, b) > cosineSimilarity(a, c), "related text should rank higher than unrelated text");
}

function testFtsQuery(): void {
  const query = toFtsQuery("find error in react build");
  assert(query.includes("error*"), "fts query should wildcard tokens");
  assert(query.includes(" OR "), "fts query should join tokens with OR");
}

function main(): void {
  testTokenize();
  testEmbeddingSimilarity();
  testFtsQuery();
  console.log("ranking tests passed");
}

main();
