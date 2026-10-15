import { redirect } from "next/navigation";

// Den publika sajten kommer senare (PLAN.md §0). Tills dess leder roten till arbetsytan.
export default function Home() {
  redirect("/admin");
}
