/**
 * Minimal ESM pino browser stub for @aztec/bb.js.
 * bb.js only uses pino for debug/info logging via createDebugLogger().
 * This avoids the CJS/ESM incompatibility with the real pino package.
 */

const noop = () => {};

function pino(opts = {}) {
  const level = opts.level || 'info';
  const name = opts.name || '';

  const logger = {
    level,
    info: noop,
    debug: noop,
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    fatal: console.error.bind(console),
    trace: noop,
    silent: noop,
    verbose: noop,
    child(bindings) {
      return pino({ ...opts, name: bindings.name || name });
    },
  };

  return logger;
}

export { pino };
export default pino;
