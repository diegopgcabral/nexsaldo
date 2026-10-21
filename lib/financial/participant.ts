import { z } from "zod";

const participantSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type ParticipantListItem = {
  id: string;
  name: string;
  isActive: boolean;
  isOwner?: boolean;
  phone?: string | null;
};

export function formatBrazilianPhone(phone: string | null | undefined) {
  const rawDigits = String(phone ?? "").replace(/\D/g, "");
  const digits =
    rawDigits.startsWith("55") && rawDigits.length >= 12
      ? rawDigits.slice(2)
      : rawDigits;
  if (!digits) return "";
  const local = digits.slice(0, 11);
  if (local.length <= 2) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`;
  if (local.length <= 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

export function parseParticipantInput(input: {
  name: unknown;
  phone?: unknown;
}) {
  const result = participantSchema.safeParse(input);
  if (!result.success)
    return { error: "Informe um nome de até 100 caracteres." };

  const rawDigits = String(input.phone ?? "").replace(/\D/g, "");
  const digits =
    rawDigits.startsWith("55") && rawDigits.length >= 12
      ? rawDigits.slice(2)
      : rawDigits;
  if (digits && (digits.length < 10 || digits.length > 11))
    return { error: "Informe um celular com DDD válido." };
  return {
    data: { ...result.data, phone: digits ? `+55${digits}` : null },
  };
}
