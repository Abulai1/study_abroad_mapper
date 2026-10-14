import MapApp from "@/components/MapApp";
import { createClient } from "@/lib/supabase/server";

// Server Component: works out who's signed in, then hands off to the interactive map.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <MapApp userId={user?.id ?? null} userEmail={user?.email ?? null} />;
}
