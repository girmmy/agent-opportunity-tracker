import { z } from 'zod';
import { ACTIVITY_KINDS, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/workspace';
const optionalText = z.string().trim().max(4000).nullable().optional();
const date = z.string().date().nullable().optional();
const uuid = z.string().uuid().nullable().optional();
export const parseTaskInput = (input: unknown) => z.object({ title: z.string().trim().min(1).max(300), status: z.enum(TASK_STATUSES).optional(), priority: z.enum(TASK_PRIORITIES).optional(), due_date: date, opportunity_id: uuid, notes: optionalText }).safeParse(input);
export const parseContactInput = (input: unknown) => z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email().nullable().optional(), organization: optionalText, title: optionalText, opportunity_id: uuid, last_contacted_at: date, notes: optionalText }).safeParse(input);
export const parseActivityInput = (input: unknown) => z.object({ opportunity_id: uuid, contact_id: uuid, kind: z.enum(ACTIVITY_KINDS).optional(), body: z.string().trim().min(1).max(4000), occurred_at: z.string().datetime().nullable().optional() }).safeParse(input);
export function responseError(error: z.ZodError) { return error.issues.map((issue) => issue.message).join('; '); }
