/* tslint:disable */
 
export const memory: WebAssembly.Memory;
export const __wbg_cipherstate_free: (a: number, b: number) => void;
export const cipherstate_get_accumulator_sum: (a: number) => bigint;
export const cipherstate_get_registers: (a: number) => [number, number];
export const cipherstate_new: (a: number, b: number) => number;
export const decrypt_blocks_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => [number, number];
export const encrypt_blocks_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => [number, number];
export const execute_round_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
export const shake256_hash: (a: number, b: number, c: number) => [number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_start: () => void;
