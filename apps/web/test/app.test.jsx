import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

// jsdom no implementa canvas: el banner simplemente no se dibuja en los tests.
HTMLCanvasElement.prototype.getContext = () => null;
Element.prototype.scrollIntoView = () => {};

describe('landing', () => {
  it('explica qué es y enlaza a la demo y al código', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Investiga, modera y administra');
    expect(screen.getByRole('link', { name: 'Probar la demo' })).toHaveAttribute('href', '#demo');
    expect(screen.getByRole('link', { name: /Ver el código/ })).toHaveAttribute('href', expect.stringContaining('github.com/AlejandroDukesini/DC-CHATBOT'));
  });

  it('la guía de comandos se genera desde el registro compartido', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Moderación/ }));
    expect(screen.getByText('&ban <usuario> [motivo]')).toBeInTheDocument();
  });
});

describe('demo interactiva', () => {
  const log = () => screen.getByRole('log', { name: 'Mensajes' });

  it('muestra datos precargados y responde a un comando escrito', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(log()).getByText(/Bienvenid@ al servidor de pruebas/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Mensaje para #general/), '&ping{Enter}');
    expect(await within(log()).findByText('🏓 Pong')).toBeInTheDocument();
  });

  it('sugiere comandos mientras se escribe', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/Mensaje para #general/), '&merc');
    expect(screen.getByRole('listbox', { name: 'Sugerencias de comandos' })).toHaveTextContent('&mercado');
  });

  it('aplica los permisos según la identidad elegida y permite reiniciar', async () => {
    const user = userEvent.setup();
    render(<App />);
    const members = screen.getByRole('complementary', { name: 'Miembros' });

    await user.click(screen.getByRole('button', { name: 'Sam · Miembro' }));
    await user.click(screen.getByRole('button', { name: '🔨 Banear' }));
    expect(await within(log()).findByText(/Necesitas el permiso/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ana · Dueña' }));
    await user.click(screen.getByRole('button', { name: '🔨 Banear' }));
    expect(await within(members).findByText(/Baneados — 1/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Reiniciar demo/ }));
    expect(within(members).queryByText(/Baneados/)).not.toBeInTheDocument();
    expect(screen.getByText(/Demo reiniciada/)).toBeInTheDocument();
  });

  it('el botón "Probar" de una funcionalidad rellena la demo', async () => {
    const user = userEvent.setup();
    render(<App />);
    const card = screen.getByRole('heading', { name: 'Economía y bolsa' }).closest('article');
    await user.click(within(card).getByRole('button', { name: /Probar/ }));
    expect(screen.getByLabelText(/Mensaje para #general/)).toHaveValue('&mercado');
  });
});
