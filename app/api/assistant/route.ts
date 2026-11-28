import { createUIMessageStreamResponse, hasToolCall, isStepCount, streamText, toUIMessageStream, type ModelMessage } from "ai";
import { connection } from "next/server";
import { z } from "zod";
import { can } from "@/lib/access";
import { buildSystemPrompt } from "@/lib/ai/assistant-prompt";
import { MAX_QUESTION_CHARS } from "@/lib/ai/limits";
import { getModel, getModelName } from "@/lib/ai/model";
import { buildTools } from "@/lib/ai/tools";
import { logBlocked, logView } from "@/lib/audit";
import { clinicToday } from "@/lib/clinic-date";
import { ASKED_ASSISTANT, countAssistantQuestionsToday } from "@/lib/db/queries/audit";
import { getPatient, isPatientId } from "@/lib/db/queries/patients";
import { getSession } from "@/lib/session";

/** Tool calls plus the answer can take a while. */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
/** How much of each question the audit log keeps. */
const LOGGED_QUESTION_CHARS = 200;
/** Earlier messages sent back to the model, as plain text only. */
const HISTORY_MESSAGES = 8;
/** Tool calls plus the final answer. */
const MAX_STEPS = 5;
const TIMEOUT_MS = 45_000;

function dailyLimit(test: boolean): number {
  const n = Number(test ? process.env.ASSISTANT_TEST_DAILY_LIMIT : process.env.ASSISTANT_DAILY_LIMIT);
  if (Number.isInteger(n) && n >= 0) return n;
  return test ? 150 : 200;
}

function maxOutputTokens(): number {
  const n = Number(process.env.ASSISTANT_MAX_OUTPUT_TOKENS);
  return Number.isInteger(n) && n > 0 ? n : 800;
}

const Body = z.object({
  patientId: z.string().refine(isPatientId, "patientId must be a patient id."),
  messages: z
    .array(z.object({ role: z.string(), parts: z.array(z.record(z.string(), z.unknown())).max(100) }))
    .min(1)
    .max(100),
});

type ClientMessage = z.infer<typeof Body>["messages"][number];

/**
 * The browser's chat history is not trusted: only the text of user and assistant
 * messages is kept, plus earlier declines as their fixed wording. Tool calls and
 * outputs sent back by the browser are dropped, so a forged tool result can't
 * reach the model; it calls the tools again when it needs data.
 */
function toModelText(message: ClientMessage): string {
  return message.parts
    .map((p) => {
      if (p.type === "text" && typeof p.text === "string") return p.text;
      const output = p.output as { message?: unknown } | undefined;
      if (message.role === "assistant" && p.type === "tool-decline" && typeof output?.message === "string") return output.message;
      return "";
    })
    .join("")
    .trim();
}

/**
 * POST /api/assistant { patientId, messages } — a streamed answer about the patient
 * whose page is open. The patient is fixed here, never by the model. Roles without
 * the assistant (Front Desk) get 403 and a blocked row in the audit log.
 */
export async function POST(request: Request) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send a patientId and the messages." }, { status: 400, headers: NO_STORE });

  const patient = await getPatient(parsed.data.patientId);
  if (!patient) return Response.json({ error: "No patient with this id." }, { status: 404, headers: NO_STORE });
  const record = { type: "patient", id: patient.id, label: patient.name };

  if (!can(session.role, "assistant")) {
    await logBlocked(session, "Tried to open the assistant", record, { via: "api" });
    return Response.json({ error: "Your role can't use the assistant." }, { status: 403, headers: NO_STORE });
  }

  const today = clinicToday();
  const limit = dailyLimit(session.isTest);
  if ((await countAssistantQuestionsToday(today, { test: session.isTest })) >= limit) {
    return Response.json(
      { error: `The demo answers up to ${limit} questions a day. Try again tomorrow.` },
      { status: 429, headers: NO_STORE },
    );
  }

  const messages = parsed.data.messages;
  const last = messages[messages.length - 1];
  const question = last.role === "user" ? toModelText(last) : "";
  if (!question || question.length > MAX_QUESTION_CHARS) {
    return Response.json({ error: `Ask a question of up to ${MAX_QUESTION_CHARS} characters.` }, { status: 400, headers: NO_STORE });
  }

  // Logged before the model runs, so a failed answer is still on record.
  await logView(session, ASKED_ASSISTANT, record, {
    question: question.slice(0, LOGGED_QUESTION_CHARS),
    chars: question.length,
  });

  const history: ModelMessage[] = messages
    .slice(-HISTORY_MESSAGES)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: toModelText(m) }))
    .filter((m) => m.content.length > 0);

  const tools = buildTools({ session, patient: { id: patient.id, name: patient.name, mrn: patient.mrn, sex: patient.sex } });
  const result = streamText({
    model: getModel(),
    system: buildSystemPrompt({ patient, role: session.role, today }),
    messages: history,
    tools,
    stopWhen: [isStepCount(MAX_STEPS), hasToolCall("decline")],
    maxOutputTokens: maxOutputTokens(),
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return createUIMessageStreamResponse({
    headers: NO_STORE,
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      sendReasoning: false,
      // The test runner records which model answered and the tokens it used.
      messageMetadata: session.isTest
        ? ({ part }) =>
            part.type === "finish"
              ? { model: getModelName() ?? null, inputTokens: part.totalUsage.inputTokens ?? null, outputTokens: part.totalUsage.outputTokens ?? null }
              : undefined
        : undefined,
      onError: (error) => {
        console.error("Assistant answer failed", error);
        return "The assistant couldn't answer just now. Please try again.";
      },
    }),
  });
}
