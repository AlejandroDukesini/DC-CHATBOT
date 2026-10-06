import { Component } from 'react';
import { STORAGE_KEY } from '../../demo/sandbox.js';

/** Si la demo falla al renderizar, la landing sigue funcionando y se ofrece reiniciarla. */
export class DemoErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[demo]', error);
  }

  reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // almacenamiento no disponible
    }
    location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        <p className="font-medium">La demo encontró un error inesperado.</p>
        <p className="mt-1 text-red-300/80">Reiniciarla restaura los datos de demostración.</p>
        <button type="button" onClick={this.reset} className="mt-4 rounded-md bg-red-500/20 px-3 py-1.5 font-medium hover:bg-red-500/30">
          ↺ Reiniciar demo
        </button>
      </div>
    );
  }
}
