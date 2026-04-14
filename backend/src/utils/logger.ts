const ts = () => new Date().toISOString();

const isVerbose = process.env.LOG_LEVEL === 'verbose';

export const verbose = (...args: unknown[]): void => {
  if (isVerbose) console.log(ts(), '[verbose]', ...args);
};
export const info = (...args: unknown[]): void => console.log(ts(), ...args);
export const warn = (...args: unknown[]): void => console.warn(ts(), ...args);
export const error = (...args: unknown[]): void => console.error(ts(), ...args);

