/**
 * TCERP - Browser Shim for Node 'util/types'
 */
export function isDate(d: any): boolean {
  return d instanceof Date || Object.prototype.toString.call(d) === '[object Date]';
}

export function isArgumentsObject(val: any): boolean {
  return Object.prototype.toString.call(val) === '[object Arguments]';
}

export function isArrayBuffer(val: any): boolean {
  return val instanceof ArrayBuffer;
}

export function isAsyncFunction(val: any): boolean {
  return Object.prototype.toString.call(val) === '[object AsyncFunction]';
}

export function isPromise(val: any): boolean {
  return val instanceof Promise;
}

export function isMap(val: any): boolean {
  return val instanceof Map;
}

export function isSet(val: any): boolean {
  return val instanceof Set;
}

export default {
  isDate,
  isArgumentsObject,
  isArrayBuffer,
  isAsyncFunction,
  isPromise,
  isMap,
  isSet,
};
