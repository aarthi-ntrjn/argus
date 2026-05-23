import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement scrollIntoView — polyfill it so components that
// call bottomRef.current?.scrollIntoView() don't throw in tests.
Element.prototype.scrollIntoView = vi.fn();

// Node.js v25+ ships a native localStorage global that is an empty object
// (no getItem/setItem/clear) when --localstorage-file is not set. This
// breaks both globalThis.localStorage and jsdom's window.localStorage.
// Provide a simple in-memory implementation for tests.
if (typeof window !== 'undefined' && typeof window.localStorage.getItem !== 'function') {
  function makeStorage(): Storage {
    let store: Record<string, string> = {};
    return {
      getItem(key: string) {
        return key in store ? store[key] : null;
      },
      setItem(key: string, value: string) {
        store[key] = String(value);
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      },
      key(index: number) {
        return Object.keys(store)[index] ?? null;
      },
      get length() {
        return Object.keys(store).length;
      },
    };
  }
  const ls = makeStorage();
  const ss = makeStorage();
  Object.defineProperty(window, 'localStorage', { value: ls, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, configurable: true });
}
