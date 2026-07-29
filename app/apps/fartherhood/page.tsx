import "./style.css";
import FartherhoodClient from "@/components/FartherhoodClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FartherhoodPage() {
  return <FartherhoodClient />;
}
