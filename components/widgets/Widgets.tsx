import { Activity, Eye, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ModuleDef, WidgetId } from "@/lib/modules";

/**
 * Widgets på översikten. Varje widget hör till en modul i lib/modules.ts.
 * Fas 1: platshållare som visar var innehållet kommer.
 */

function Placeholder({ module, icon, title, empty, children }: { module: ModuleDef; icon: ReactNode; title: string; empty: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <EmptyState icon={icon} title={empty}>
        {children}
        {!module.enabled && <span className="mt-2 block text-xs text-ink-subtle">Byggs i fas {module.phase}</span>}
      </EmptyState>
    </Card>
  );
}

const WIDGETS: Record<WidgetId, (props: { module: ModuleDef }) => ReactNode> = {
  "watchlist-movers": ({ module }) => (
    <Placeholder module={module} icon={<Eye className="size-5" />} title="Bevakningar – störst rörelse" empty="Inga bevakningar ännu">
      Här syns dagens största kursrörelser bland bevakade bolag och avstånd till målkurs.
    </Placeholder>
  ),
  "active-analyses": ({ module }) => (
    <Placeholder module={module} icon={<FileText className="size-5" />} title="Pågående analyser" empty="Inga analyser ännu">
      Utkast och analyser som väntar på granskning listas här.
    </Placeholder>
  ),
  activity: ({ module }) => (
    <Placeholder module={module} icon={<Activity className="size-5" />} title="Senaste aktivitet" empty="Ingen aktivitet ännu">
      Nya transaktioner, bevakningar, DCF-modeller och rapporter visas i ett flöde.
    </Placeholder>
  ),
};

export function DashboardWidget({ widget, module }: { widget: WidgetId; module: ModuleDef }) {
  const Widget = WIDGETS[widget];
  return <Widget module={module} />;
}
