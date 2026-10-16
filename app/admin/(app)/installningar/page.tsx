import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { dateTime } from "@/lib/format";
import { findUserById } from "@/lib/users";

export const metadata: Metadata = { title: "Inställningar" };

export default async function SettingsPage() {
  const sessionUser = await requireUser("dashboard:read");
  const user = await findUserById(sessionUser.id);

  return (
    <div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-5">
        <Card title="Profil">
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3.5">
            <dt className="text-ink-muted">Namn</dt>
            <dd>{sessionUser.displayName}</dd>
            <dt className="text-ink-muted">Användarnamn</dt>
            <dd>{sessionUser.username}</dd>
            <dt className="text-ink-muted">Roll</dt>
            <dd>
              <Badge tone={sessionUser.role === "admin" ? "accent" : "neutral"}>{ROLE_LABELS[sessionUser.role]}</Badge>
            </dd>
            <dt className="text-ink-muted">Lösenord bytt</dt>
            <dd className="tabular">{dateTime(user?.passwordChangedAt ?? null)}</dd>
            <dt className="text-ink-muted">Konto skapat</dt>
            <dd className="tabular">{dateTime(user?.createdAt ?? null)}</dd>
          </dl>
        </Card>
        <Card title="Byt lösenord" description="Andra inloggade sessioner loggas ut när du byter.">
          <div className="max-w-md">
            <ChangePasswordForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
