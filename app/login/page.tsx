import Link from "next/link";
import Image from "next/image";

import { GoogleSignInButton } from "@/app/login/google-sign-in-button";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#091219] text-slate-100">
      <div className="relative min-h-screen overflow-hidden bg-[#091219]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="nexsaldo-grid absolute inset-0 opacity-55" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,229,153,0.08),transparent_32%),radial-gradient(circle_at_100%_50%,rgba(14,165,233,0.07),transparent_28%)]" />
          <div className="absolute inset-y-10 left-1/2 w-px bg-emerald-100/[0.035]" />
        </div>

        <div className="relative mx-auto grid min-h-screen max-w-4xl grid-rows-[auto_1fr_auto] px-6 py-10 sm:px-10 sm:py-14">
          <header className="flex items-center justify-between">
            <Link className="group flex items-center gap-3" href="/">
              <span
                className="relative flex size-10 overflow-hidden rounded-xl border border-emerald-300/15 bg-[#0b1820] shadow-[0_0_18px_rgba(0,229,153,0.12)]"
                aria-label="NexSaldo"
              >
                <Image
                  alt=""
                  className="scale-[1.26] object-cover"
                  fill
                  priority
                  sizes="40px"
                  src="/brand/nexsaldo-mark.png"
                />
              </span>
              <span>
                <span className="block text-xl font-bold tracking-tight text-white">
                  Nex<span className="text-emerald-400">Saldo</span>
                </span>
                <span className="block text-[10px] font-medium tracking-[0.11em] text-sky-200/75 uppercase">
                  Inteligência financeira
                </span>
              </span>
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(0,229,153,0.8)]" />
              Plataforma segura
            </span>
          </header>

          <section className="mx-auto flex w-full max-w-md flex-col justify-center py-14 sm:py-16">
            <div className="space-y-5 text-center">
              <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-5xl">
                Suas faturas e despesas compartilhadas, sem{" "}
                <span className="text-emerald-400">planilhas.</span>
              </h1>
              <p className="text-base leading-relaxed text-slate-400 sm:text-lg">
                Entre com sua conta Google para acessar o NexSaldo.
              </p>
            </div>
            <div className="mt-8 space-y-4">
              {error ? (
                <p
                  aria-live="polite"
                  className="rounded-lg border border-red-400/20 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                >
                  Não foi possível concluir o login. Tente novamente.
                </p>
              ) : null}
              <GoogleSignInButton />
              <p className="flex items-center justify-center gap-2 rounded-xl border border-sky-300/10 bg-[#0c1929]/80 px-4 py-3 text-xs font-medium text-sky-200/75">
                <svg
                  aria-hidden="true"
                  className="size-4 shrink-0 text-emerald-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    clipRule="evenodd"
                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.71-9.29a1 1 0 0 0-1.42-1.42L9 10.59 7.71 9.3A1 1 0 0 0 6.3 10.7l2 2a1 1 0 0 0 1.41 0l4-4Z"
                    fillRule="evenodd"
                  />
                </svg>
                Acesso seguro com sua conta Google
              </p>
            </div>
          </section>

          <footer className="flex flex-col gap-3 border-t border-white/5 pt-6 text-xs text-sky-200/55 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 NexSaldo Finanças Digitais.</span>
            <span className="flex gap-5">
              <span>Termos de Uso</span>
              <span aria-hidden="true">•</span>
              <span>Privacidade</span>
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}
