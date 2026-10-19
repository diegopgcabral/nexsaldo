"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseParticipantInput } from "@/lib/financial/participant";
import { createClient } from "@/lib/supabase/server";

export type ParticipantActionState = { error?: string; success?: boolean };
const idSchema = z.string().uuid();

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return typeof userId === "string"
    ? { supabase, userId }
    : { error: "Sua sessão expirou. Entre novamente." };
}

export async function saveParticipant(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const parsed = parseParticipantInput({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if ("error" in parsed) return { error: parsed.error };

  const rawId = formData.get("id");
  const isEditing = typeof rawId === "string" && rawId.length > 0;
  const id = isEditing ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { error: "Participante inválido." };

  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;

  if (id?.success) {
    const { data, error } = await auth.supabase
      .from("credit_card_participants")
      .update({ name: parsed.data!.name, phone: parsed.data!.phone })
      .eq("id", id.data)
      .eq("user_id", auth.userId)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505")
      return { error: "Já existe um participante com esse nome." };
    if (error || !data)
      return { error: "Não foi possível atualizar o participante." };
  } else {
    const { error } = await auth.supabase
      .from("credit_card_participants")
      .insert({
        user_id: auth.userId,
        name: parsed.data!.name,
        phone: parsed.data!.phone,
      });
    if (error?.code === "23505")
      return { error: "Já existe um participante com esse nome." };
    if (error) return { error: "Não foi possível cadastrar o participante." };
  }

  revalidatePath("/participants");
  return { success: true };
}

export async function setParticipantActive(
  id: string,
  isActive: boolean,
): Promise<ParticipantActionState> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success || typeof isActive !== "boolean")
    return { error: "Participante inválido." };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("credit_card_participants")
    .update({ is_active: isActive })
    .eq("id", parsed.data)
    .eq("user_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { error: "Não foi possível alterar o participante." };

  revalidatePath("/participants");
  return { success: true };
}

export async function saveOwnerName(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const parsed = parseParticipantInput({ name: formData.get("name") });
  if ("error" in parsed) return { error: parsed.error };
  const auth = await getAuthenticatedUser();
  if ("error" in auth) return auth;

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ credit_card_owner_name: parsed.data!.name })
    .eq("id", auth.userId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { error: "Não foi possível atualizar o nome do titular." };

  revalidatePath("/participants");
  return { success: true };
}
