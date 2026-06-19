import { redirect } from "next/navigation";

export default function WalletRedirectPage() {
  redirect("/apps/account");
}
