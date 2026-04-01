import { redirect } from "next/navigation";

// Dashboard redirects to the main app until a separate dashboard view is built
export default function DashboardPage() {
  redirect("/");
}
