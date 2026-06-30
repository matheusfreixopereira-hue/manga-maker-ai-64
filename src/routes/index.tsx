import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Sparkles, Users, FileDown, Layers, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tinta — Crie mangás com inteligência artificial" },
      {
        name: "description",
        content:
          "Transforme uma ideia, roteiro ou documento em um mangá completo, com personagens consistentes e exportação em PDF.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-ink/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center bg-ink text-paper">
              <span className="font-display text-xl leading-none">墨</span>
            </div>
            <span className="font-display text-2xl tracking-wide">TINTA</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth" className="px-3 py-2 text-sm font-medium hover:text-accent">
              Entrar
            </Link>
            <Link
              to="/auth"
              className="bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Começar agora
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b-2 border-ink/90">
        <div className="screentone pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 md:min-h-[640px] md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div className="relative z-10">
            <span className="inline-block bg-ink px-3 py-1 font-display text-sm tracking-widest text-paper">
              MANGÁ • IA • EM PORTUGUÊS
            </span>
            <h1 className="mt-6 font-display text-6xl leading-[0.95] md:text-7xl">
              DA IDEIA AO MANGÁ.
              <br />
              <span className="text-accent">EM HORAS, NÃO MESES.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Cole uma história, envie um PDF ou descreva uma ideia. A IA monta a bíblia da obra,
              cria personagens consistentes, gera storyboard, quadros e exporta o PDF pronto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="ink-border bg-accent px-6 py-3 font-display text-lg tracking-wide text-accent-foreground"
              >
                CRIAR MEU MANGÁ
              </Link>
              <a
                href="#como-funciona"
                className="ink-border bg-paper px-6 py-3 font-display text-lg tracking-wide text-ink"
              >
                COMO FUNCIONA
              </a>
            </div>
          </div>
          <div className="hero-video-fade pointer-events-none relative min-h-[360px] overflow-hidden md:absolute md:inset-y-0 md:right-0 md:w-[58%]">
            <video
              className="h-full min-h-[360px] w-full object-cover md:min-h-full"
              src="/manga-hero-bg.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-ink/10 mix-blend-multiply" />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-b-2 border-ink/90">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-4xl md:text-5xl">COMO FUNCIONA</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                t: "1. Sua história",
                d: "Escreva uma ideia, cole um roteiro ou envie PDF, DOCX ou TXT.",
              },
              {
                icon: Users,
                t: "2. Personagens fixos",
                d: "Detectamos personagens e geramos fichas visuais bloqueáveis para manter consistência.",
              },
              {
                icon: Layers,
                t: "3. Storyboard & quadros",
                d: "Roteiro por capítulo, storyboard editável, quadros gerados um a um.",
              },
              {
                icon: BookOpen,
                t: "4. Editor de páginas",
                d: "Balões e textos como camadas editáveis — nunca colados na imagem.",
              },
              {
                icon: FileDown,
                t: "5. PDF pronto",
                d: "Exporte A4/A5/B5, leitura RTL ou LTR, alta qualidade 300 DPI.",
              },
              {
                icon: ShieldCheck,
                t: "6. Seguro",
                d: "Seus arquivos ficam privados. Você aprova cada etapa antes de gastar.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="ink-border bg-card p-6">
                <Icon className="h-8 w-8 text-accent" />
                <h3 className="mt-3 font-display text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-2 border-ink/90 bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-5xl">PRONTO PARA DESENHAR SUA HISTÓRIA?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-paper/70">
            Comece grátis. Você só gera imagens quando aprova cada etapa.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-block bg-accent px-8 py-4 font-display text-xl tracking-wide text-accent-foreground"
          >
            CRIAR CONTA
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Tinta. Feito para criadores de mangá.
      </footer>
    </div>
  );
}
