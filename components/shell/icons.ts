import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  Calculator,
  Eye,
  FileOutput,
  FileText,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/modules";

export const ICONS: Record<IconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  briefcase: Briefcase,
  "arrow-left-right": ArrowLeftRight,
  eye: Eye,
  "file-text": FileText,
  calculator: Calculator,
  building: Building2,
  "file-output": FileOutput,
  settings: Settings,
};
