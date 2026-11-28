import { embed } from "ai";
import { getEmbeddingModel } from "@/lib/ai/model";
import { sql } from "@/lib/db/client";

/**
 * Evidence library search: the public health pages in data/evidence/, embedded
 * by scripts/build-evidence.ts. Cosine distance on the HNSW index (pgvector).
 */

export type EvidenceHit = {
  /** What the assistant cites, e.g. "evidence-12". */
  ref: string;
  title: string;
  url: string;
  text: string;
  distance: number;
};

export const EVIDENCE_LIMIT = 4;
/**
 * Matches further than this are off-topic. Measured on 2026-11-28: library questions
 * score 0.30–0.45 (HbA1c, LDL, eGFR, blood pressure); off-topic ones 0.69+ (statins,
 * migraines, broken arm). 0.60 sits between them.
 */
export const MAX_DISTANCE = 0.6;

export async function searchEvidence(query: string): Promise<EvidenceHit[]> {
  const { embedding } = await embed({ model: getEmbeddingModel(), value: query });
  const rows = await sql`
    SELECT id::text, source_title, source_url, content, (embedding <=> ${JSON.stringify(embedding)}::vector)::float8 AS distance
    FROM evidence_chunks
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${EVIDENCE_LIMIT}
  `;
  return rows
    .filter((r) => Number(r.distance) <= MAX_DISTANCE)
    .map((r) => ({
      ref: `evidence-${r.id}`,
      title: r.source_title,
      url: r.source_url,
      text: r.content,
      distance: Math.round(Number(r.distance) * 1000) / 1000,
    }));
}
