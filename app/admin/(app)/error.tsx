"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Felsida inne i arbetsytan: menyn ligger kvar och användaren kan försöka igen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <h1 className="mb-8 font-display text-[2.125rem] leading-[1.1] font-medium text-ink sm:text-[2.75rem]">Något gick fel</h1>
      <Card>
        <p className="text-ink">Sidan kunde inte visas just nu.</p>
        <p className="mt-1 text-sm text-ink-muted">Försök igen. Kvarstår felet, hör av dig till utskottets administratör{error.digest ? ` och ange felkod ${error.digest}` : ""}.</p>
        <Button variant="secondary" className="mt-5" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden /> Försök igen
        </Button>
      </Card>
    </div>
  );
}
