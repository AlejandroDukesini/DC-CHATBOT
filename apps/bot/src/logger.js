// Registro mínimo con marca de tiempo. Nunca se registran tokens ni claves.
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export const logger = {
  info: (...args) => console.log(`[${stamp()}]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] ⚠️`, ...args),
  error: (...args) => console.error(`[${stamp()}] ❌`, ...args),
};
