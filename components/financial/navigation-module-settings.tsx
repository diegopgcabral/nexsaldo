"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  saveNavigationModules,
  type SettingsActionState,
} from "@/app/(financial)/settings/actions";
import { Icon } from "@/components/financial/icons";
import { useToast } from "@/components/financial/toast-provider";
import type { NavigationModules } from "@/lib/financial/navigation-modules";

const initialState: SettingsActionState = {};

type ModuleRowProps = {
  checked: boolean;
  description: string;
  icon: "receipt" | "creditCard" | "briefcase";
  name: string;
  title: string;
};

function ModuleRow({
  checked,
  description,
  icon,
  name,
  title,
}: ModuleRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-xl bg-[#111319]/80 p-4 transition hover:bg-[#111319]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#272a30] text-emerald-300">
        <Icon className="size-5" name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-400">
          {description}
        </span>
      </span>
      <input
        className="peer sr-only"
        defaultChecked={checked}
        name={name}
        type="checkbox"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-600 transition peer-checked:bg-emerald-400 after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

export function NavigationModuleSettings({
  modules,
}: {
  modules: NavigationModules;
}) {
  const [state, action, pending] = useActionState(
    saveNavigationModules,
    initialState,
  );
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (state.error) notify("error", state.error);
    if (state.success) {
      notify("success", "Menus atualizados.");
      router.refresh();
    }
  }, [notify, router, state.error, state.success]);

  return (
    <form
      action={action}
      className="rounded-2xl bg-[#191c21] p-6 shadow-xl shadow-black/20 sm:p-8"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <Icon className="size-6" name="dashboard" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase">
              Personalização
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Módulos do menu
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Escolha o que aparece na navegação. Desativar um módulo apenas o
              oculta: seus dados continuam guardados.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-[#272a30] px-3 py-1 text-xs text-slate-300">
          Visão geral sempre ativa
        </span>
      </div>

      <div className="mt-6 space-y-3">
        <ModuleRow
          checked={modules.transactions}
          description="Agrupa Receitas e Despesas em um único menu."
          icon="receipt"
          name="transactions"
          title="Lançamentos"
        />
        <ModuleRow
          checked={modules.creditCards}
          description="Inclui cartões, faturas e conciliação. Ao desativar, Pessoas, Participantes e Divisão de contas também são ocultados."
          icon="creditCard"
          name="creditCards"
          title="Cartões de crédito"
        />
        <ModuleRow
          checked={modules.investments}
          description="Mantém o espaço de Investimentos disponível no menu."
          icon="briefcase"
          name="investments"
          title="Investimentos"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="rounded-xl bg-[#00e599] px-5 py-2.5 text-sm font-semibold text-[#003822] shadow-[0_0_20px_rgba(0,229,153,0.24)] disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar menus"}
        </button>
      </div>
    </form>
  );
}
