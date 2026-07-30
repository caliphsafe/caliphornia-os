import { redirect } from "next/navigation";

export default function UsersRedirectPage() {
  redirect("/dashboard/accounts");
}
