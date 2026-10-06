/**
 * Error pensado para mostrarse al usuario tal cual.
 * Cualquier otro error se registra en logs y el usuario recibe un mensaje genérico,
 * para no filtrar detalles internos (rutas, claves, trazas).
 */
export class UserError extends Error {
  constructor(message, { title = 'No se pudo completar' } = {}) {
    super(message);
    this.name = 'UserError';
    this.title = title;
  }
}

export const isUserError = (err) => err instanceof UserError || err?.name === 'UserError';
