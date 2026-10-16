import type { Metadata } from "next";
import { BenchmarkManager } from "@/components/settings/BenchmarkManager";
import { requireUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { listBenchmarks } from "@/lib/benchmarks";
import { getDb } from "@/lib/db";
import { lastPriceUpdate } from "@/lib/market/prices";

export const metadata: Metadata = { title: "Jämförelseindex" };

export default async function BenchmarksPage() {
  const user = await requireUser("dashboard:read");
  const db = getDb();
  const [benchmarks, lastRun] = await Promise.all([listBenchmarks(db), lastPriceUpdate(db)]);
  return <BenchmarkManager initial={benchmarks} canEdit={can(user, "settings:benchmarks")} lastRun={lastRun} />;
}
