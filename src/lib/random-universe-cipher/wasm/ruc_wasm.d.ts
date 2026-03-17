/* tslint:disable */
 

export class CipherState {
  free(): void;
  [Symbol.dispose](): void;
  constructor(key_material_registers: Uint8Array);
  readonly get_registers: Uint8Array;
  readonly get_accumulator_sum: bigint;
}

/**
 * Decrypt blocks in batch - same as encryption (XOR-based stream cipher)
 */
export function decrypt_blocks_batch(ciphertext_blocks: Uint8Array, key: Uint8Array, iv: Uint8Array, start_block_number: number, key_material_registers: Uint8Array, selectors: Uint16Array, sboxes: Uint8Array, round_keys: Uint8Array): Uint8Array;

/**
 * Process multiple blocks in batch - COMPLETE IMPLEMENTATION
 * Reduces JS/WASM boundary crossings by 1000x!
 * This is the main performance optimization (5-10x faster than per-block calls)
 */
export function encrypt_blocks_batch(plaintext_blocks: Uint8Array, key: Uint8Array, iv: Uint8Array, start_block_number: number, key_material_registers: Uint8Array, selectors: Uint16Array, sboxes: Uint8Array, round_keys: Uint8Array): Uint8Array;

/**
 * Execute a single round of encryption (optimized WASM version)
 * This is the HOT PATH - called 24 times per block
 */
export function execute_round_wasm(state: CipherState, round_index: number, selectors: Uint16Array, sbox: Uint8Array, round_key_bytes: Uint8Array, key_constants: Uint8Array): void;

/**
 * Compute SHAKE256 hash with arbitrary output length
 * Matches the TypeScript shake256Hash() function exactly
 */
export function shake256_hash(data: Uint8Array, output_length: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_cipherstate_free: (a: number, b: number) => void;
  readonly cipherstate_get_accumulator_sum: (a: number) => bigint;
  readonly cipherstate_get_registers: (a: number) => [number, number];
  readonly cipherstate_new: (a: number, b: number) => number;
  readonly decrypt_blocks_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => [number, number];
  readonly encrypt_blocks_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => [number, number];
  readonly execute_round_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
  readonly shake256_hash: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
