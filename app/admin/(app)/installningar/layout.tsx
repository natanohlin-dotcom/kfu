import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { PageHeader } from "@/components/ui/PageHeader";

/** Gemensam rubrik och flikar. Behörighet kontrolleras i varje sida (layouter körs inte om vid navigering). */
export default function SettingsLayout({ children }: LayoutProps<"/admin/installningar">) {
  return (
    <div>
      <PageHeader title="Inställningar" />
      <SettingsTabs />
      {children}
    </div>
  );
}
