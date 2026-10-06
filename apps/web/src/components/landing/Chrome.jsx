import { README_URL, REPO_URL } from '../../lib/links.js';

export function GitHubIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2 font-semibold text-zinc-100">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      DC Chatbot
    </a>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-4" aria-label="Principal">
          <a href="#demo" className="px-2 py-1 text-zinc-400 hover:text-zinc-100">Demo</a>
          <a href="#comandos" className="hidden px-2 py-1 text-zinc-400 hover:text-zinc-100 sm:inline">Comandos</a>
          <a href="#arquitectura" className="hidden px-2 py-1 text-zinc-400 hover:text-zinc-100 sm:inline">Arquitectura</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1.5 text-zinc-200 hover:border-ink-600">
            <GitHubIcon /> GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ink-800 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p>React · Vite · Tailwind · discord.js · Netlify Functions</p>
        <div className="flex gap-4">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">Código</a>
          <a href={README_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">Documentación</a>
          <a href="#demo" className="hover:text-zinc-200">Demo</a>
        </div>
      </div>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="mb-2 font-mono text-xs tracking-wider text-blurple uppercase">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h2>
      {children && <p className="mt-3 text-zinc-400">{children}</p>}
    </div>
  );
}
