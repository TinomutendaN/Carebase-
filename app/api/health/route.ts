import { connection } from "next/server";
import { getModelName, getProvider, isModelKeySet, type AiProvider } from "@/lib/ai/model";

export async function GET() {
  // Always run at request time, never prerendered at build.
  await connection();

  const database = { connected: false, error: undefined as string | undefined };
  const pgvector = { enabled: false, version: null as string | null };

  try {
    const { sql } = await import("@/lib/db/client");
    await sql`SELECT 1`;
    database.connected = true;
    const rows = await sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
    if (rows.length > 0) {
      pgvector.enabled = true;
      pgvector.version = String(rows[0].extversion);
    }
  } catch {
    // Generic message only: never echo the connection string or driver error.
    database.error = process.env.DATABASE_URL ? "Could not connect to the database." : "DATABASE_URL is not set.";
  }

  let provider: AiProvider | null = null;
  let modelNameSet = false;
  let keySet = false;
  try {
    provider = getProvider();
    modelNameSet = Boolean(getModelName(provider));
    keySet = isModelKeySet(provider);
  } catch {
    // Unknown AI_PROVIDER: leave everything false.
  }

  const ok = database.connected && pgvector.enabled && modelNameSet && keySet;

  return Response.json(
    { ok, database, pgvector, model: { provider, modelNameSet, keySet } },
    { status: ok ? 200 : 503 },
  );
}
