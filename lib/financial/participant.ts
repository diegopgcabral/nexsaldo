import { z } from "zod";

const participantSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type ParticipantListItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export function parseParticipantInput(input: { name: unknown }) {
  const result = participantSchema.safeParse(input);
  return result.success
    ? { data: result.data }
    : { error: "Informe um nome de até 100 caracteres." };
}
