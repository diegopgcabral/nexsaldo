import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const participantIdSchema = z.string().uuid();

function deletionErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23503") {
    return "Ainda existe um vínculo financeiro deste participante. Tente novamente em instantes.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão para excluir este participante. Atualize a página e tente novamente.";
  }
  if (error.code === "PGRST202" || error.code === "42883") {
    return "A exclusão está sendo atualizada. Atualize a página e tente novamente.";
  }
  if (error.message === "Participant not found") {
    return "Este participante não foi encontrado. Atualize a página para ver a lista atual.";
  }
  return "Não foi possível concluir a exclusão agora. Seus dados foram preservados.";
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/participants/[participantId]">,
) {
  const { participantId } = await context.params;
  const parsed = participantIdSchema.safeParse(participantId);
  if (!parsed.success) {
    return Response.json({ error: "Participante inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims.sub !== "string") {
    return Response.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 },
    );
  }

  const { error } = await supabase.rpc("delete_credit_card_participant", {
    p_participant_id: parsed.data,
  });

  if (error) {
    console.error("Participant deletion failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    return Response.json(
      { error: deletionErrorMessage(error) },
      { status: 409 },
    );
  }

  return Response.json({ success: true });
}
