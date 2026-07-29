import "./share.css";
import ShareClient from "@/components/share/ShareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SharePage() {
  return <ShareClient />;
}
