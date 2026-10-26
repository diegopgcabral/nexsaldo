import { notFound } from "next/navigation";

import {
  centsToCurrency,
  summarizeStatement,
  type StatementManualCharge,
  type StatementPurchase,
} from "@/lib/financial/account-division";
import { getBankAppearance } from "@/lib/financial/credit-card";
import {
  getCurrentMonthReference,
  isMonthReference,
} from "@/lib/financial/month";
import { createClient } from "@/lib/supabase/server";
import { PrintStatementButton } from "@/components/financial/print-statement-button";

export default async function AccountDivisionPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ participantId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ participantId }, query] = await Promise.all([params, searchParams]);
  const month = isMonthReference(query.month ?? null)
    ? query.month!
    : getCurrentMonthReference();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (typeof userId !== "string") notFound();
  const { data: person } = await supabase
    .from("credit_card_participants")
    .select("id, name, phone, is_owner")
    .eq("id", participantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!person) notFound();
  const { data: profile } = person.is_owner
    ? await supabase
        .from("profiles")
        .select("credit_card_owner_name, display_name")
        .eq("id", userId)
        .maybeSingle()
    : { data: null };
  const [purchaseResult, cardResult, chargeResult] = await Promise.all([
    supabase
      .from("credit_card_purchases")
      .select(
        "id, card_id, description, purchased_on, installment_number, installment_count, is_recurring",
      )
      .eq("user_id", userId)
      .eq("invoice_month", `${month}-01`),
    supabase
      .from("credit_cards")
      .select("id, name, bank_name")
      .eq("user_id", userId),
    supabase
      .from("participant_manual_charges")
      .select(
        "id, description, amount, due_on, notes, installment_number, installment_count, is_recurring",
      )
      .eq("user_id", userId)
      .eq("participant_id", participantId)
      .eq("reference_month", `${month}-01`)
      .order("created_at"),
  ]);
  const purchaseRows = purchaseResult.data ?? [];
  const cards = new Map((cardResult.data ?? []).map((card) => [card.id, card]));
  const splitQuery = supabase
    .from("credit_card_purchase_splits")
    .select("purchase_id, amount, paid_at")
    .eq("user_id", userId)
    .is("paid_at", null)
    .in(
      "purchase_id",
      purchaseRows.map((purchase) => purchase.id),
    );
  const { data: splits } = purchaseRows.length
    ? person.is_owner
      ? await splitQuery.is("participant_id", null)
      : await splitQuery.eq("participant_id", participantId)
    : { data: [] };
  const splitMap = new Map(
    (splits ?? []).map((split) => [split.purchase_id, String(split.amount)]),
  );
  const purchases: StatementPurchase[] = purchaseRows.flatMap((purchase) => {
    const amount = splitMap.get(purchase.id);
    const card = cards.get(purchase.card_id);
    return amount && card
      ? [
          {
            cardId: card.id,
            cardName: card.name,
            cardBankName: card.bank_name,
            description: purchase.description,
            amount,
            purchasedOn: purchase.purchased_on,
            installmentNumber: purchase.installment_number,
            installmentCount: purchase.installment_count,
            isRecurring: purchase.is_recurring,
          },
        ]
      : [];
  });
  const charges: StatementManualCharge[] = (chargeResult.data ?? []).map(
    (charge) => ({
      id: charge.id,
      description: charge.description,
      amount: String(charge.amount),
      dueOn: charge.due_on,
      notes: charge.notes,
      installmentNumber: charge.installment_number,
      installmentCount: charge.installment_count,
      isRecurring: charge.is_recurring,
    }),
  );
  const summary = summarizeStatement(purchases, charges, []);
  const [year, monthNumber] = month.split("-");
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(Number(year), Number(monthNumber) - 1, 1),
  );
  const titleMonth = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}/${year}`;
  const statementName =
    profile?.credit_card_owner_name || profile?.display_name || person.name;
  const printFileName = `${statementName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")}_${monthNumber}${year}`;
  return (
    <main className="account-division-print min-h-screen bg-white p-4 text-slate-900 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] sm:p-10">
      <style>{`
        @media print {
          @page { margin: 0; }
          .account-division-print { padding: 8mm !important; }
        }
      `}</style>
      <article className="mx-auto max-w-3xl bg-white p-7 font-sans shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-emerald-600 pb-4 print:pb-2">
          <div>
            <p className="text-[19px] font-extrabold print:text-[16px]">
              Nex<span className="text-emerald-600">Saldo</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500 print:mt-0 print:text-[10px]">
              Demonstrativo de contas
            </p>
          </div>
        </header>
        <section className="mt-6 flex items-center justify-between gap-4 print:mt-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[23px] font-bold print:text-[20px]">
              {statementName}
            </h1>
            <p className="text-[13px] font-semibold text-slate-500 print:text-[12px]">
              {titleMonth}
            </p>
          </div>
          <div className="justify-self-end rounded-lg bg-emerald-600 px-5 py-3 text-right text-white print:px-4 print:py-2">
            <p className="text-[9px] font-bold tracking-wider uppercase">
              Total a pagar
            </p>
            <p className="text-[23px] font-extrabold print:text-[20px]">
              {centsToCurrency(summary.totalDueCents)}
            </p>
          </div>
        </section>
        <section className="mt-6 space-y-3 print:mt-3 print:space-y-2">
          <h2 className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
            Descrição das contas
          </h2>
          {summary.cards.map((issuer) => {
            const bank = getBankAppearance(issuer.bankName);
            return (
              <div
                key={issuer.id}
                className="overflow-hidden border-t-2 border-slate-200 pt-3 first:border-t-0 first:pt-0 print:pt-2"
              >
                <div className="flex items-center gap-2 px-1 pb-1.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-10 items-center rounded border px-1.5 text-[8px] font-bold ${cardThumbnailTones[bank.tone] ?? cardThumbnailTones.emerald}`}
                    >
                      {bank.monogram}
                    </span>
                    <span className="text-[13px] font-bold uppercase">
                      {issuer.name}
                    </span>
                  </div>
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead className="text-left text-[9px] font-bold text-slate-700">
                    <tr>
                      <th className="w-16 px-1.5 py-1">Data</th>
                      <th className="px-1.5 py-1">Descrição</th>
                      <th className="w-20 px-1.5 py-1 text-right">R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuer.purchases.map((purchase, index) => (
                      <tr
                        key={`${purchase.description}-${index}`}
                        className="odd:bg-slate-100"
                      >
                        <td className="px-1.5 py-1">
                          {formatPdfDate(purchase.purchasedOn)}
                        </td>
                        <td className="px-1.5 py-1">
                          {purchase.description}{" "}
                          {purchase.installmentCount > 1 ? (
                            <strong>
                              - Parcela {purchase.installmentNumber}/
                              {purchase.installmentCount}
                            </strong>
                          ) : null}
                          {purchase.isRecurring ? (
                            <span className="ml-1 inline-flex rounded bg-emerald-100 px-1 py-px text-[8px] font-bold text-emerald-800">
                              RECORRENTE
                            </span>
                          ) : null}
                        </td>
                        <td className="px-1.5 py-1 text-right">
                          {centsToCurrency(
                            BigInt(Math.round(Number(purchase.amount) * 100)),
                          ).replace("R$", "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={2} className="px-1.5 pt-1.5">
                        Subtotal
                      </td>
                      <td className="px-1.5 pt-1.5 text-right">
                        {centsToCurrency(issuer.totalCents).replace("R$", "")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
          <div className="border-t-2 border-slate-200 pt-3 print:pt-2">
            <div className="px-1 pb-1.5 text-[13px] font-bold uppercase">
              Contas adicionais
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead className="text-left text-[9px] font-bold text-slate-700">
                <tr>
                  <th className="px-1.5 py-1">Descrição</th>
                  <th className="w-20 px-1.5 py-1 text-right">R$</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="odd:bg-slate-100">
                    <td className="px-1.5 py-1">
                      {charge.description}{" "}
                      {charge.installmentCount > 1 ? (
                        <strong>
                          - Parcela {charge.installmentNumber}/
                          {charge.installmentCount}
                        </strong>
                      ) : null}
                      {charge.isRecurring ? (
                        <span className="ml-1 inline-flex rounded bg-emerald-100 px-1 py-px text-[8px] font-bold text-emerald-800">
                          RECORRENTE
                        </span>
                      ) : null}
                    </td>
                    <td className="px-1.5 py-1 text-right">
                      {centsToCurrency(
                        BigInt(Math.round(Number(charge.amount) * 100)),
                      ).replace("R$", "")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="px-1.5 pt-1.5">Subtotal</td>
                  <td className="px-1.5 pt-1.5 text-right">
                    {centsToCurrency(summary.manualTotalCents).replace(
                      "R$",
                      "",
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <footer className="mt-8 flex justify-between border-t-2 border-slate-900 pt-4 text-[17px] font-extrabold print:mt-4 print:pt-2">
          <span>Total a pagar</span>
          <span>{centsToCurrency(summary.totalDueCents)}</span>
        </footer>
      </article>
      <PrintStatementButton fileName={printFileName} floating />
    </main>
  );
}

function formatPdfDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(`${value}T12:00:00`));
}

const cardThumbnailTones: Record<string, string> = {
  violet:
    "border-violet-700 from-[#7020a7] to-[#251136] bg-gradient-to-br text-white",
  orange:
    "border-orange-700 from-[#593113] to-[#1e1b1a] bg-gradient-to-br text-white",
  slate:
    "border-slate-500 from-[#31353d] to-[#121418] bg-gradient-to-br text-white",
  blue: "border-sky-700 from-[#1a3c61] to-[#111923] bg-gradient-to-br text-white",
  red: "border-red-700 from-[#572229] to-[#19191d] bg-gradient-to-br text-white",
  gold: "border-amber-700 from-[#453b21] to-[#17191c] bg-gradient-to-br text-white",
  marketYellow:
    "border-[#c8a900] from-[#fff36a] to-[#e5bf00] bg-gradient-to-br text-[#161b24]",
  emerald:
    "border-emerald-700 from-[#21443a] to-[#151d1b] bg-gradient-to-br text-white",
};
