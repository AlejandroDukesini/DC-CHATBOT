import { useEffect, useRef, useState } from 'react';

// play() devuelve una promesa que se rechaza si el navegador bloquea la reproducción automática.
function tryPlay(el, onFail) {
  try {
    Promise.resolve(el?.play()).catch(onFail);
  } catch {
    onFail();
  }
}

/** Reproduce de verdad la emisora que el comando `radio` dejó sonando en el sandbox. */
export function RadioPlayer({ station, onStop }) {
  const audio = useRef(null);
  const [status, setStatus] = useState('loading');
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = volume;
  }, [volume, station]);

  // El componente se monta de nuevo con cada emisora (key = url), así que el estado ya empieza en "loading".
  useEffect(() => {
    tryPlay(audio.current, () => setStatus('blocked'));
  }, [station.url]);

  const toggle = () => {
    const el = audio.current;
    if (el.paused) tryPlay(el, () => setStatus('error'));
    else el.pause();
  };

  const label = {
    loading: 'Conectando…',
    playing: 'En directo',
    paused: 'En pausa',
    blocked: 'Pulsa ▶ para escuchar',
    error: 'No se pudo reproducir',
  }[status];

  return (
    <div className="border-b border-ink-700 bg-ink-900 px-4 py-2.5" aria-label="Reproductor de radio">
      <audio
        ref={audio}
        src={station.url}
        preload="none"
        onPlaying={() => setStatus('playing')}
        onPause={() => setStatus('paused')}
        onWaiting={() => setStatus('loading')}
        onError={() => setStatus('error')}
      />
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${status === 'playing' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-500' : 'bg-zinc-500'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">📻 {station.name}</div>
          <div className="truncate text-xs text-zinc-500">{label} · 🔊 Radio Lounge</div>
        </div>
        <button type="button" onClick={toggle} className="rounded p-1.5 text-zinc-300 hover:bg-ink-700" aria-label={status === 'playing' ? 'Pausar' : 'Reproducir'}>
          {status === 'playing' ? '⏸' : '▶'}
        </button>
        <button type="button" onClick={onStop} className="rounded p-1.5 text-zinc-300 hover:bg-ink-700" aria-label="Detener radio">
          ⏹
        </button>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="mt-2 w-full accent-blurple"
        aria-label="Volumen"
      />
    </div>
  );
}
