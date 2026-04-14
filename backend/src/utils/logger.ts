const ts = () => new Date().toISOString();

export const log = (...args: unknown[]): void => console.log(ts(), ...args);
export const warn = (...args: unknown[]): void => console.warn(ts(), ...args);
export const error = (...args: unknown[]): void => console.error(ts(), ...args);
