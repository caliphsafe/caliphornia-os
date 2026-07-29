import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NearbyRedirectPage() {
  redirect("/apps/share");
}
