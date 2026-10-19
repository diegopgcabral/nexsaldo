import Link from "next/link";
import Image from "next/image";

import { GoogleSignInButton } from "@/app/login/google-sign-in-button";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080b10] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="nexsaldo-grid absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_25%,rgba(0,229,153,0.14),transparent_38%),radial-gradient(circle_at_95%_55%,rgba(14,165,233,0.12),transparent_32%)]" />
        <div className="absolute bottom-0 -left-40 size-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-[#080b10]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link className="group flex" href="/">
            <span className="relative h-11 w-44 overflow-hidden transition group-hover:scale-[1.02]" aria-label="NexSaldo">
              <Image
                alt="NexSaldo"
                className="object-cover scale-[1.6]"
                fill
                priority
                sizes="176px"
                src="/brand/nexsaldo-logo.png"
              />
            </span>
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center px-6 py-14">
        <div className="max-w-2xl space-y-8">
          <div className="space-y-5">
            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Clareza para cuidar do seu{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-white bg-clip-text text-transparent">
                dinheiro.
              </span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Entre com sua conta Google para acessar o NexSaldo.
            </p>
          </div>
          <div className="max-w-sm space-y-4">
            {error ? (
              <p
                aria-live="polite"
                className="rounded-lg border border-red-400/20 bg-red-950/50 px-3 py-2 text-sm text-red-200"
              >
                Não foi possível concluir o login. Tente novamente.
              </p>
            ) : null}
            <GoogleSignInButton />
            <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
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
        </div>
      </section>
    </main>
  );
}
