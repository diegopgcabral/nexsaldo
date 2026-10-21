import { ParticipantManager } from "@/components/financial/participant-manager";
import type { ParticipantListItem } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export default async function ParticipantsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let participants: ParticipantListItem[] = [];
  let loadError = false;
  let ownerName = "Você";

  if (typeof userId === "string") {
    const { data, error } = await supabase
      .from("credit_card_participants")
      .select("id, name, phone, is_active")
      .eq("user_id", userId)
      .eq("is_owner", false)
      .order("name");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credit_card_owner_name, display_name")
      .eq("id", userId)
      .maybeSingle();
    loadError = Boolean(error || profileError);
    ownerName =
      profile?.credit_card_owner_name || profile?.display_name || "Você";
    participants = (data ?? []).map((person) => ({
      id: person.id,
      name: person.name,
      phone: person.phone,
      isActive: person.is_active,
    }));
  }

  return (
    <ParticipantManager
      participants={participants}
      ownerName={ownerName}
      loadError={loadError}
    />
  );
}
