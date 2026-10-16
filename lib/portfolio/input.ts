import { z } from "zod";

/** Indata för en ny transaktion (delas av formulär och API). Belopp och kassapåverkan räknas på servern. */

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ange datum som ÅÅÅÅ-MM-DD")
  .refine((d) => d >= "2000-01-01" && d <= new Date().toISOString().slice(0, 10), "Datumet kan inte ligga i framtiden");
const positive = (label: string) => z.number({ error: `Ange ${label}` }).positive(`${label[0].toUpperCase()}${label.slice(1)} måste vara större än noll`);
const note = z.string().trim().max(300).optional();
const fees = z.number().min(0, "Courtage kan inte vara negativt").max(1e6).default(0);
const fx = z.number().positive("Valutakursen måste vara större än noll").optional();

export const TransactionInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("deposit"), tradeDate: date, amount: positive("belopp"), note }),
  z.object({ type: z.literal("withdrawal"), tradeDate: date, amount: positive("belopp"), note }),
  z.object({ type: z.literal("fee"), tradeDate: date, amount: positive("belopp"), note }),
  z.object({ type: z.literal("buy"), tradeDate: date, symbol: z.string().min(1).max(24), quantity: positive("antal"), price: positive("kurs"), fees, fxRate: fx, note }),
  z.object({ type: z.literal("sell"), tradeDate: date, symbol: z.string().min(1).max(24), quantity: positive("antal"), price: positive("kurs"), fees, fxRate: fx, note }),
  z.object({ type: z.literal("dividend"), tradeDate: date, symbol: z.string().min(1).max(24), amount: positive("belopp"), fxRate: fx, note }),
]);
export type TransactionInput = z.infer<typeof TransactionInput>;
