import HomeScreen from "@/components/HomeScreen";
import { requireCurrentAppUser } from "@/lib/users";

export default async function HomePage() {
  const user = await requireCurrentAppUser();
  return <HomeScreen user={user} />;
}
