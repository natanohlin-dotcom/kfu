import { z } from "zod";
import { WATCH_STATUSES } from "./status";

const text = z.string().trim().max(5000);
const target = z.number().positive("Målkursen måste vara större än noll").max(1e7).nullable();

export const NewWatchInput = z.object({
  symbol: z.string().min(1).max(24),
  status: z.enum(WATCH_STATUSES).optional(),
  thesis: text.optional(),
  triggers: text.optional(),
  targetPrice: target.optional(),
  ownerId: z.number().int().positive().nullable().optional(),
});

export const WatchPatchInput = z.object({
  status: z.enum(WATCH_STATUSES).optional(),
  thesis: text.nullable().optional(),
  triggers: text.nullable().optional(),
  targetPrice: target.optional(),
  ownerId: z.number().int().positive().nullable().optional(),
});

export const NoteInput = z.object({ body: z.string().trim().min(1, "Skriv något").max(2000) });
