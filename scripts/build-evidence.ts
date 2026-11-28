/**
 * Build the evidence library: chunk the public health pages in data/evidence/,
 * embed each chunk, and replace the rows in evidence_chunks. Safe to run more than once.
 * Run with: npm run evidence:build
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { embedMany } from "ai";
import { getEmbeddingModel, getEmbeddingModelName } from "../lib/ai/model";
import { sql } from "../lib/db/client";

const DIR = join(process.cwd(), "data", "evidence");
/** About 220 tokens: long enough to hold an idea, short enough to retrieve precisely. */
const TARGET_CHARS = 1000;

type Page = { title: string; url: string; body: string };
type Chunk = { title: string; url: string; index: number; content: string };

/** Front matter (title, url, …) between --- lines, then the page text. */
function readPage(file: string): Page {
  const text = readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file} has no front matter.`);
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2];
  }
  if (!meta.title || !meta.url) throw new Error(`${file} needs a title and a url.`);
  return { title: meta.title, url: meta.url, body: match[2] };
}

/**
 * Split at headings, then pack each section's paragraphs into chunks of about
 * TARGET_CHARS, repeating the last paragraph at the start of the next chunk.
 * Each chunk starts with "Title — Section" so it reads on its own.
 */
function chunkPage(page: Page): Chunk[] {
  const sections: { heading: string; paragraphs: string[] }[] = [];
  let current = { heading: "", paragraphs: [] as string[] };
  for (const block of page.body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const heading = block.match(/^#{1,4} (.*)$/);
    if (heading && !block.includes("\n")) {
      if (current.paragraphs.length) sections.push(current);
      // The page's own title heading isn't a section.
      current = { heading: heading[1] === page.title ? "" : heading[1], paragraphs: [] };
    } else {
      current.paragraphs.push(block);
    }
  }
  if (current.paragraphs.length) sections.push(current);

  const chunks: Chunk[] = [];
  const push = (heading: string, paragraphs: string[]) => {
    const label = heading ? `${page.title} — ${heading}` : page.title;
    chunks.push({ title: page.title, url: page.url, index: chunks.length, content: `${label}\n\n${paragraphs.join("\n\n")}` });
  };
  for (const { heading, paragraphs } of sections) {
    let packed: string[] = [];
    let size = 0;
    for (const p of paragraphs) {
      if (size > 0 && size + p.length > TARGET_CHARS) {
        push(heading, packed);
        const overlap = packed[packed.length - 1];
        packed = overlap.length < TARGET_CHARS / 2 ? [overlap] : [];
        size = packed.reduce((n, x) => n + x.length, 0);
      }
      packed.push(p);
      size += p.length;
    }
    if (packed.length) push(heading, packed);
  }
  return chunks;
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
  const chunks = files.flatMap((f) => chunkPage(readPage(f)));
  console.log(`${files.length} pages → ${chunks.length} chunks. Embedding with ${getEmbeddingModelName()}…`);

  const { embeddings, usage } = await embedMany({ model: getEmbeddingModel(), values: chunks.map((c) => c.content) });
  if (embeddings.some((e) => e.length !== 1536)) throw new Error("Expected 1536-dimension embeddings (evidence_chunks.embedding).");

  // Replace the whole library in one transaction, so a failed run leaves the old one in place.
  await sql.transaction([
    sql`DELETE FROM evidence_chunks`,
    ...chunks.map(
      (c, i) => sql`
        INSERT INTO evidence_chunks (source_title, source_url, chunk_index, content, embedding)
        VALUES (${c.title}, ${c.url}, ${c.index}, ${c.content}, ${JSON.stringify(embeddings[i])}::vector)
      `,
    ),
  ]);

  const [stats] = await sql`
    SELECT count(*)::int AS chunks, count(DISTINCT source_url)::int AS pages,
           pg_size_pretty(pg_total_relation_size('evidence_chunks')) AS table_size,
           pg_size_pretty(pg_database_size(current_database())) AS db_size
    FROM evidence_chunks
  `;
  console.log(`Embedding tokens: ${usage.tokens}`);
  console.log(`Saved ${stats.chunks} chunks from ${stats.pages} pages. evidence_chunks: ${stats.table_size}. Database: ${stats.db_size}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
