import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const expenseIdSchema = z.string().uuid();
const paymentProofBucket = "expense-payment-proofs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const { expenseId } = await params;
  const id = expenseIdSchema.safeParse(expenseId);
  if (!id.success) return new NextResponse("Comprovante inválido.", { status: 400 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") {
    return new NextResponse("Não autenticado.", { status: 401 });
  }

  const { data: proof } = await supabase
    .from("expense_payment_proofs")
    .select("storage_path, original_file_name")
    .eq("expense_id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!proof) return new NextResponse("Comprovante não encontrado.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";

  const { data: signedUrl, error } = await supabase.storage
    .from(paymentProofBucket)
    .createSignedUrl(
      proof.storage_path,
      60,
      download ? { download: proof.original_file_name } : undefined,
    );
  if (error || !signedUrl) {
    return new NextResponse("Não foi possível preparar o download.", { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
