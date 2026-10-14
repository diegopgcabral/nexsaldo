import { CreditCardManager } from "@/components/financial/credit-card-manager";
import type { CreditCardListItem } from "@/lib/financial/credit-card";
import { createClient } from "@/lib/supabase/server";

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  let cards: CreditCardListItem[] = [];
  let loadError = false;

  if (typeof userId === "string") {
    const { data, error } = await supabase
      .from("credit_cards")
      .select("id, bank_name, name, due_day")
      .eq("user_id", userId)
      .order("due_day", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    loadError = Boolean(error);
    cards = (data ?? []).map((card) => ({
      id: card.id,
      bankName: card.bank_name,
      name: card.name,
      dueDay: card.due_day,
    }));
  }

  return <CreditCardManager cards={cards} loadError={loadError} />;
}
