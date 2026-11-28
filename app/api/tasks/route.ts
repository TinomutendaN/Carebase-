import { connection } from "next/server";
import { z } from "zod";
import { canCompleteTask } from "@/lib/access";
import { logBlocked, logChange } from "@/lib/audit";
import { completeTask, getTaskForCompletion } from "@/lib/db/queries/tasks";
import { getSession } from "@/lib/session";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const CompleteBody = z.object({ id: z.number().int().positive() });

/**
 * PATCH /api/tasks — { id }: mark a task done. You can complete your own tasks;
 * tasks_all (Admin) can complete anyone's. Refusals are logged as blocked.
 */
export async function PATCH(request: Request) {
  await connection();
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });

  const body = CompleteBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send the task id as a number." }, { status: 400, headers: NO_STORE });

  const task = await getTaskForCompletion(body.data.id);
  if (!task) return Response.json({ error: "No task with this id." }, { status: 404, headers: NO_STORE });

  const record = { type: "task", id: String(task.id), label: task.patientName };
  if (!canCompleteTask(session.role, session.accountId, task.assigneeId)) {
    await logBlocked(session, "Tried to complete another person's task", record, {
      title: task.title,
      assignee: task.assigneeName,
    });
    return Response.json({ error: "You can only complete tasks assigned to you." }, { status: 403, headers: NO_STORE });
  }

  if (task.status !== "open" || !(await completeTask(task.id))) {
    return Response.json({ error: "This task is already done." }, { status: 409, headers: NO_STORE });
  }
  await logChange(session, "Completed task", record, { title: task.title, assignee: task.assigneeName });
  return Response.json({ id: task.id, status: "done" }, { headers: NO_STORE });
}
