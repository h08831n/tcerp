/**
 * TCERP - Browser Shim for Node 'util' module
 */
import * as utilTypes from './util-types';

export function deprecate<T extends Function>(fn: T, _msg?: string, _code?: string): T {
  return fn;
}

export function inherits(ctor: any, superCtor: any) {
  if (ctor === undefined || ctor === null)
    throw new TypeError('The constructor to "inherits" must not be empty');

  if (superCtor === undefined || superCtor === null)
    throw new TypeError('The super constructor to "inherits" must not be empty');

  if (superCtor.prototype === undefined) {
    throw new TypeError('The super constructor to "inherits" must have a prototype');
  }

  ctor.super_ = superCtor;
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}

export function promisify(orig: Function) {
  return function (...args: any[]) {
    return new Promise((resolve, reject) => {
      orig(...args, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  };
}

export function format(...args: any[]): string {
  return args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
}

export function inspect(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export const types = utilTypes;
export const isDate = utilTypes.isDate;

const utilShim = {
  deprecate,
  inherits,
  promisify,
  format,
  inspect,
  types,
  isDate,
};

export default utilShim;
