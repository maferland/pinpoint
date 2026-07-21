import { useState, type ReactNode } from "react";
import { Button, Badge } from "./ui/index.tsx";

export function Landing() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (document.documentElement.dataset.theme as "dark" | "light") ?? "dark";
  });

  const toggleTheme = () => {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("pinpoint-theme", next);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Nav theme={theme} onThemeToggle={toggleTheme} />
      <main>
        <Hero />
        <HowItWorks />
        <JsonPayload />
        <Agents />
        <Handoff />
      </main>
      <Footer />
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────── */

function Nav({ theme, onThemeToggle }: { theme: "dark" | "light"; onThemeToggle: () => void }) {
  return (
    <header
      className="sticky top-0 z-10 border-b border-border"
      style={{ backgroundColor: "var(--bg)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div className="max-w-[920px] mx-auto px-6 flex items-center justify-between h-14">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <div
            className="rounded-full shrink-0"
            style={{ width: 11, height: 11, backgroundColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" }}
          />
          <span className="font-mono font-semibold text-txt" style={{ fontSize: 15, letterSpacing: "-0.4px" }}>pinpoint</span>
        </a>
        <nav className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-5">
            <NavLink href="#how">How it works</NavLink>
            <NavLink href="#agents">Agents</NavLink>
            <NavLink href="#handoff">Handoff</NavLink>
            <NavLink href="https://github.com/maferland/pinpoint">GitHub</NavLink>
          </div>
          <button
            className="w-7 h-7 rounded-[7px] border border-border flex items-center justify-center text-muted hover:text-txt hover:border-faint transition-colors shrink-0"
            onClick={onThemeToggle}
            aria-label="Toggle color scheme"
          >
            {theme === "dark" ? <SunIcon size={13} /> : <MoonIcon size={13} />}
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-[14px] text-muted hover:text-txt transition-colors no-underline"
    >
      {children}
    </a>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  const [tab, setTab] = useState<"terminal" | "claude">("terminal");

  const TERMINAL_CMD = "curl -fsSL https://pinpoint.maferland.com/install.sh | bash";
  const CLAUDE_CMD = [
    "/plugin marketplace add maferland/pinpoint",
    "/plugin install pinpoint@pinpoint-marketplace",
    "/pinpoint:install",
  ].join("\n");

  return (
    <section className="py-20 text-center">
      <div className="max-w-[920px] mx-auto px-6">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Badge variant="muted">Open source · MIT</Badge>
        </div>

        {/* Headline */}
        <h1
          className="font-bold text-txt mb-4 tracking-tight"
          style={{ fontSize: "clamp(38px,6vw,68px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}
        >
          Visual feedback for<br />AI coding agents.
        </h1>

        <p className="text-[19px] text-muted max-w-[520px] mx-auto mb-10 leading-relaxed">
          Point at what's wrong. The agent gets coordinates and comments for each pin, then works through them.
        </p>

        {/* CTA row */}
        <div className="flex items-center justify-center gap-3 mb-12 flex-wrap">
          <Button
            variant="accent"
            size="md"
            onClick={() => window.open("https://github.com/maferland/pinpoint", "_blank")}
          >
            Star on GitHub
          </Button>
          <Button
            variant="surface"
            size="md"
            onClick={() => { window.location.href = "/try"; }}
          >
            Try the demo
          </Button>
        </div>

        {/* Install tabs */}
        <div
          className="inline-flex flex-col max-w-[560px] w-full border border-border rounded-[10px] overflow-hidden text-left"
          style={{ backgroundColor: "var(--bg2)" }}
        >
          <div className="flex gap-1 px-1.5 pt-1.5 border-b border-border" style={{ backgroundColor: "var(--surface)" }}>
            {(["terminal", "claude"] as const).map((t) => (
              <button
                key={t}
                className={`px-3.5 py-2 font-mono text-[12px] font-medium rounded-t-[6px] transition-colors border-b-2 ${
                  tab === t
                    ? "text-txt border-accent bg-bg2"
                    : "text-muted border-transparent hover:text-txt"
                }`}
                onClick={() => setTab(t)}
              >
                {t === "terminal" ? "Terminal" : "Claude Code"}
              </button>
            ))}
          </div>
          <div className="relative px-4 py-3.5 pr-10">
            <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all m-0">
              {(tab === "terminal" ? TERMINAL_CMD : CLAUDE_CMD).split("\n").map((line, i) => (
                <div key={i}>
                  <TerminalLine command={line} prompt={tab === "terminal"} />
                </div>
              ))}
            </pre>
            <div className="absolute top-2.5 right-2.5">
              <CopyButton text={tab === "terminal" ? TERMINAL_CMD : CLAUDE_CMD} />
            </div>
          </div>
        </div>

        {/* Product screenshot */}
        <div className="mt-14 rounded-[12px] overflow-hidden border border-border shadow-token mx-auto" style={{ maxWidth: 920 }}>
          <img
            src="/assets/screenshot-dark.png"
            alt="Pinpoint annotation UI"
            className="w-full block dark:block hidden"
            loading="lazy"
          />
          <img
            src="/assets/screenshot-light.png"
            alt="Pinpoint annotation UI"
            className="w-full block dark:hidden"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────── */

function HowItWorks() {
  const STEPS = [
    {
      title: "The agent takes a screenshot",
      body: "Of whatever it's building. A page in your dev server, a Storybook story, an iOS simulator.",
    },
    {
      title: "You pin what's wrong",
      body: "Click to drop a pin, drag to draw a region, type your comment. Hit Send.",
    },
    {
      title: "The agent fixes what you pointed at",
      body: "Each pin becomes a task. The agent works through them and asks for another round when it's done.",
    },
  ];

  return (
    <Section id="how" title="How it works" lede="Your agent drives. You point at what's wrong.">
      <div className="flex flex-col gap-5 mb-10">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-start gap-4">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0 mt-0.5"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {i + 1}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-txt mb-0.5">{s.title}</p>
              <p className="text-[14px] text-muted leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── JSON payload ────────────────────────────────────────────────────── */

function tokenizeJson(code: string): { text: string; color?: string }[] {
  const out: { text: string; color?: string }[] = [];
  const re = /("[\w]+")\s*:|:\s*("(?:[^"\\]|\\.)*")|:\s*(\d+\.?\d*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ text: code.slice(last, m.index) });
    if (m[1]) {
      out.push({ text: m[1], color: "var(--agent)" });
      out.push({ text: m[0].slice(m[1].length) });
    } else if (m[2]) {
      out.push({ text: m[0].replace(m[2], "") });
      out.push({ text: m[2], color: "var(--good)" });
    } else if (m[3]) {
      out.push({ text: m[0].replace(m[3], "") });
      out.push({ text: m[3], color: "var(--accent)" });
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last) });
  return out;
}

function JsonHighlight({ code }: { code: string }) {
  const tokens = tokenizeJson(code);
  return (
    <pre className="font-mono text-[13px] text-muted leading-relaxed px-5 py-5 m-0 overflow-x-auto">
      {tokens.map((t, i) => (
        t.color ? <span key={i} style={{ color: t.color }}>{t.text}</span> : t.text
      ))}
    </pre>
  );
}

function JsonPayload() {
  const sample = `{
  "annotations": [
    {
      "number": 1,
      "image": "/tmp/screenshot.png",
      "box": { "x": 10.2, "y": 5.3, "width": 35.0, "height": 12.5 },
      "comment": "Button text is truncated on mobile"
    }
  ]
}`;

  return (
    <Section title="What Pinpoint sends back" lede="Coordinates as percentages, so they survive any screen size or resolution.">
      <div
        className="rounded-[10px] border border-border overflow-hidden"
        style={{ backgroundColor: "var(--bg2)" }}
      >
        <div className="px-5 py-2.5 border-b border-border">
          <span className="font-mono text-[10px] text-faint tracking-widest uppercase">annotations.json</span>
        </div>
        <JsonHighlight code={sample} />
      </div>
    </Section>
  );
}

/* ── Agents ──────────────────────────────────────────────────────────── */

function Agents() {
  const CARDS = [
    {
      title: "Claude Code",
      body: "Slash command, no setup beyond install.",
      code: "/pinpoint:review",
      prompt: false,
    },
    {
      title: "Any agent",
      body: "Anything that can run a shell command can drive the CLI and read the JSON it prints.",
      code: undefined,
    },
    {
      title: "Direct CLI",
      body: "Spawns the server, opens the browser, blocks on Send, prints JSON to stdout.",
      code: "pinpoint review app.png",
    },
  ];

  return (
    <Section id="agents" title="Use it with your agent" lede="Slash command or shell. Pick whichever fits.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="flex flex-col gap-3 p-5 rounded-[12px] border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-faint"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}
          >
            <p className="text-[14px] font-semibold text-txt">{c.title}</p>
            <p className="text-[13px] text-muted leading-relaxed flex-1">{c.body}</p>
            {c.code && <CodeBlock code={c.code} prompt={c.prompt ?? true} />}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Handoff ─────────────────────────────────────────────────────────── */

function Handoff() {
  return (
    <Section id="handoff" title="Hand it off. Get it back." lede="A review exports as a .pinpoint.zip. Send it to a designer, PM, or teammate — they add pins and send it back.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Export">
          <p className="text-[13px] text-muted leading-relaxed mb-3">Click the download icon in the toolbar, or from the command line:</p>
          <CodeBlock code="pinpoint export <reviewId>" />
        </Card>
        <Card title="Open someone else's session">
          <p className="text-[13px] text-muted leading-relaxed mb-3">Same browser UI, blocks until you hit Send, prints JSON.</p>
          <CodeBlock code="pinpoint open session.pinpoint.zip" />
        </Card>
      </div>
    </Section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-[920px] mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
        <span className="text-[13px] text-faint">
          Pinpoint is{" "}
          <a href="https://github.com/maferland/pinpoint/blob/main/LICENSE" className="text-muted hover:text-txt transition-colors">MIT licensed</a>.
          {" "}Built by{" "}
          <a href="https://maferland.com" className="text-muted hover:text-txt transition-colors">Marc-Antoine Ferland</a>.
        </span>
        <span className="text-[13px] text-faint flex items-center gap-3">
          <a href="https://github.com/maferland/pinpoint" className="text-muted hover:text-txt transition-colors">GitHub</a>
          <span className="text-border">·</span>
          <a href="https://github.com/maferland/pinpoint/blob/main/CHANGELOG.md" className="text-muted hover:text-txt transition-colors">Changelog</a>
          <span className="text-border">·</span>
          <a href="https://github.com/maferland/pinpoint/issues" className="text-muted hover:text-txt transition-colors">Issues</a>
        </span>
      </div>
    </footer>
  );
}

/* ── Shared primitives ───────────────────────────────────────────────── */

function Section({
  id,
  title,
  lede,
  children,
}: {
  id?: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-16">
      <div className="max-w-[920px] mx-auto px-6">
        <h2
          className="font-bold text-txt mb-3 tracking-tight"
          style={{ fontSize: "clamp(26px,3.5vw,38px)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
        <p className="text-[17px] text-muted mb-8 leading-relaxed">{lede}</p>
        {children}
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-[12px] border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-faint"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}
    >
      <p className="text-[14px] font-semibold text-txt">{title}</p>
      {children}
    </div>
  );
}

function CodeBlock({ code, prompt = true }: { code: string; prompt?: boolean }) {
  return (
    <pre
      className="font-mono text-[13px] rounded-[10px] border border-border px-4 py-3 m-0 overflow-x-auto"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <TerminalLine command={code} prompt={prompt} />
    </pre>
  );
}

function TerminalLine({ command, prompt = true }: { command: string; prompt?: boolean }) {
  const [head, ...rest] = command.split(" ");
  return (
    <>
      {prompt && <span className="text-faint select-none">$ </span>}
      <span style={{ color: "var(--accent)" }}>{head}</span>
      {rest.length > 0 && <span className="text-muted"> {rest.join(" ")}</span>}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={copy}
      className="w-7 h-7 flex items-center justify-center rounded-[5px] text-faint hover:text-muted transition-colors"
      aria-label="Copy"
    >
      {copied ? <CheckIcon size={13} /> : <ClipIcon size={13} />}
    </button>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────── */

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ClipIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--good)" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
