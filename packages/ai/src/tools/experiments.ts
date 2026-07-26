import { createTool } from "@mastra/core/tools";
import {
  closeRoutineExperiment,
  createRoutineExperiment,
  getActiveRoutineExperiment,
  listRoutineExperiments,
  saveRoutineExperiment,
} from "@skintext/db";
import type { RoutineExperiment } from "@skintext/shared";
import { generateId } from "@skintext/shared";
import { z } from "zod";
import { getSkintextRuntime } from "../runtime";
import { type OneOffReminderSchedule, scheduleOneOffReminder } from "./one-off-reminders";

const reviewScheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("relative"),
    amount: z.number().int().positive().max(180),
    unit: z.enum(["minutes", "hours", "days", "weeks"]),
  }),
  z.object({
    type: z.literal("local_time"),
    date: z.string(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
]);

export const startExperimentTool = createTool({
  id: "start-skincare-experiment",
  description:
    "Start one durable one-variable skincare experiment. Only one experiment can be active at a time. Optionally schedule its agreed review.",
  inputSchema: z.object({
    change: z.string().min(1).max(500),
    baseline: z.string().max(1000).optional(),
    reviewSchedule: reviewScheduleSchema.optional(),
  }),
  execute: async ({ change, baseline, reviewSchedule }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const now = new Date().toISOString();
    const experiment: RoutineExperiment = {
      id: generateId("experiment"),
      userId: runtime.userId,
      change: change.trim(),
      baseline: baseline?.trim() || undefined,
      startedAt: now,
      status: "active",
      createdAt: now,
    };

    const created = await createRoutineExperiment(experiment);
    if (!created.created) {
      return {
        started: false,
        reason: "An experiment is already active.",
        activeExperiment: created.experiment,
      };
    }

    runtime.agentContext.activeExperiment = experiment;
    if (!reviewSchedule) return { started: true, experiment, reminderScheduled: false };

    if (!runtime.scheduleOneOffReminderWorkflow) {
      return {
        started: true,
        experiment,
        reminderScheduled: false,
        reminderError: "Reminder scheduling is unavailable.",
      };
    }

    const reminder = await scheduleOneOffReminder(
      {
        userId: runtime.userId,
        timezone: runtime.timezone,
        schedule: reviewSchedule as OneOffReminderSchedule,
        kind: "skin_checkin",
        message: `Review the active skincare experiment: ${experiment.change}`,
      },
      runtime.scheduleOneOffReminderWorkflow,
    );

    if (!reminder.scheduled) {
      return {
        started: true,
        experiment,
        reminderScheduled: false,
        reminderError: reminder.error,
      };
    }

    const updated: RoutineExperiment = {
      ...experiment,
      plannedReviewAt: reminder.sendAt,
      reminderId: reminder.reminderId,
      updatedAt: new Date().toISOString(),
    };
    await saveRoutineExperiment(updated);
    runtime.agentContext.activeExperiment = updated;
    return { started: true, experiment: updated, reminderScheduled: true };
  },
});

export const getActiveExperimentTool = createTool({
  id: "get-active-skincare-experiment",
  description: "Get the user's current active one-variable skincare experiment.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    return { experiment: await getActiveRoutineExperiment(userId) };
  },
});

export const listExperimentsTool = createTool({
  id: "list-skincare-experiments",
  description: "List recent skincare experiments and their outcomes.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: async ({ limit }, context) => {
    const { userId } = getSkintextRuntime(context.requestContext);
    return { experiments: await listRoutineExperiments(userId, limit ?? 10) };
  },
});

export const closeExperimentTool = createTool({
  id: "close-skincare-experiment",
  description:
    "Complete or stop the active skincare experiment and optionally record whether it helped, made no difference, worsened things, or was inconclusive.",
  inputSchema: z.object({
    experimentId: z.string().optional(),
    status: z.enum(["completed", "stopped"]),
    outcome: z.enum(["helped", "no_change", "worse", "inconclusive"]).optional(),
    outcomeNotes: z.string().max(1000).optional(),
  }),
  execute: async ({ experimentId, status, outcome, outcomeNotes }, context) => {
    const runtime = getSkintextRuntime(context.requestContext);
    const active = experimentId ? null : await getActiveRoutineExperiment(runtime.userId);
    const targetId = experimentId ?? active?.id;
    if (!targetId) return { closed: false, message: "No active experiment found." };

    const experiment = await closeRoutineExperiment(runtime.userId, targetId, {
      status,
      outcome,
      outcomeNotes,
    });
    if (!experiment) return { closed: false, message: "Experiment not found." };
    if (runtime.agentContext.activeExperiment?.id === experiment.id) {
      runtime.agentContext.activeExperiment = null;
    }
    return { closed: true, experiment };
  },
});
