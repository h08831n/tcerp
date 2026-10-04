import { Buffer } from 'buffer';
import utilShim from '../packages/shared/src/shims/util';

// Ensure Buffer, global, process, and util are available on all scopes
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).util = utilShim;
  (window as any).nodeUtils = utilShim;
  if (!(window as any).process) {
    (window as any).process = { env: {} };
  }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).global = globalThis;
  (globalThis as any).util = utilShim;
  (globalThis as any).nodeUtils = utilShim;
  if (!(globalThis as any).process) {
    (globalThis as any).process = { env: {} };
  }
}

export { Buffer, utilShim as util };
