import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../src/lib/markdown.jsx';

const lookup = {
  member: (id) => ({ 'u-ana': { name: 'Ana' } })[id],
  channel: (id) => ({ 'c-logs': { name: 'logs' } })[id],
  role: () => ({ name: 'Novato', color: '#F0B232' }),
};

describe('Markdown', () => {
  it('renderiza formato, menciones y enlaces seguros', () => {
    const { container } = render(<Markdown lookup={lookup} text={'**Hola** <@u-ana> en <#c-logs> con `código` y [Wiki](https://es.wikipedia.org/wiki/X)'} />);
    expect(container.querySelector('strong')).toHaveTextContent('Hola');
    expect(container).toHaveTextContent('@Ana en #logs');
    expect(container.querySelector('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('trata como texto lo que parece sintaxis pero no lo es (citas [1], asteriscos sueltos)', () => {
    const { container } = render(<Markdown lookup={lookup} text={'Frase citada [1] y otra [2] — precio 5 * 3'} />);
    expect(container).toHaveTextContent('Frase citada [1] y otra [2] — precio 5 * 3');
  });

  it('no interpreta HTML ni enlaces javascript:', () => {
    const { container } = render(<Markdown lookup={lookup} text={'<img src=x onerror=alert(1)> [x](javascript:alert(1))'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
