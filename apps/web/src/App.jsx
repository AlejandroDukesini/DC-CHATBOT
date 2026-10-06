import { useState } from 'react';
import { Footer, Header, SectionHeading } from './components/landing/Chrome.jsx';
import { Features, Hero } from './components/landing/Intro.jsx';
import { CommandGuide } from './components/landing/CommandGuide.jsx';
import { Architecture, Comparison } from './components/landing/Architecture.jsx';
import { Simulator } from './components/demo/Simulator.jsx';
import { DemoErrorBoundary } from './components/demo/DemoErrorBoundary.jsx';

export default function App() {
  // Los botones "Probar" de la landing rellenan el campo de la demo.
  const [prefill, setPrefill] = useState(null);
  const tryCommand = (text) => {
    setPrefill({ text, at: Date.now() });
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Header />
      <main>
        <Hero />
        <section id="demo" className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="demo-title">
          <SectionHeading eyebrow="Demo interactiva" title={<span id="demo-title">Pruébalo sin instalar nada</span>}>
            Un servidor sandbox con miembros y datos ficticios. Elige con quién actúas, escribe comandos o usa los atajos.
            Tus cambios se guardan solo en este navegador y puedes reiniciarlos cuando quieras.
          </SectionHeading>
          <DemoErrorBoundary>
            <Simulator prefill={prefill} />
          </DemoErrorBoundary>
        </section>
        <Features onTry={tryCommand} />
        <CommandGuide onTry={tryCommand} />
        <Architecture />
        <Comparison />
      </main>
      <Footer />
    </>
  );
}
