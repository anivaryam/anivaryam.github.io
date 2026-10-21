/**
 * C++ WASM Worker for Parallel Block Processing
 * 
 * Each worker loads the C++ WASM module and processes blocks independently
 */

import type { ParallelWorkerMessage, ParallelWorkerResponse } from '../cipher/parallel-worker';

let wasmModule: any = null;
let encryptBatchFn: any = null;
let decryptBatchFn: any = null;

// Initialize WASM module
async function initWASM(): Promise<void> {
  if (wasmModule) return;
  
  try {
    // Dynamic import to avoid Vite build errors when WASM is not yet built
    const wasm = await import(/* @vite-ignore */ '../../cpp-wasm/pkg/ruc_wasm');
    
    // Initialize WASM module - default() returns the Module object (or Promise if not ready)
    const module = await wasm.default();
    
    // Wait for runtime to be fully initialized if needed
    // Emscripten may return a Promise if runtime isn't ready
    const actualModule = module instanceof Promise ? await module : module;
    
    // Check if functions are available (Emscripten exports with underscore prefix)
    const hasExpandKey = typeof actualModule._ruc_expand_key === 'function' || 
                        typeof actualModule['_ruc_expand_key'] === 'function';
    const hasMalloc = typeof actualModule._malloc === 'function' || 
                     typeof actualModule['_malloc'] === 'function';
    const hasHeap = (actualModule.HEAPU8 && actualModule.HEAPU8.buffer) ||
                   (actualModule['HEAPU8'] && actualModule['HEAPU8'].buffer);
    
    if (!hasExpandKey || !hasMalloc || !hasHeap) {
      // Debug: show what's available
      const allKeys = Object.keys(actualModule);
      const rucKeys = allKeys.filter(k => k.includes('ruc') || k.includes('malloc') || k === 'HEAPU8');
      throw new Error(`C++ WASM module not properly initialized. Available keys: ${rucKeys.slice(0, 10).join(', ')}`);
    }
    
    wasmModule = actualModule;
    
    // Try using cwrap for functions with uint64_t to avoid BigInt conversion issues
    // cwrap expects function names without underscore prefix
    if (actualModule.cwrap) {
      try {
        encryptBatchFn = actualModule.cwrap('_ruc_encrypt_blocks_batch', null, 
          ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
        decryptBatchFn = actualModule.cwrap('_ruc_decrypt_blocks_batch', null,
          ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
      } catch (e) {
        // cwrap might not work, fall back to direct calls
        console.warn('cwrap failed, using direct calls:', e);
      }
    }
  } catch (error) {
    console.error('Failed to load C++ WASM in worker:', error);
    throw error;
  }
}

// Process blocks using C++ WASM
async function processBlocks(
  blocks: Uint8Array,
  numBlocks: number,
  key: Uint8Array,
  iv: Uint8Array,
  startBlockNumber: number,
  encrypt: boolean
): Promise<Uint8Array> {
  if (!wasmModule) {
    await initWASM();
  }
  
  const startTime = performance.now();
  const BLOCK_SIZE = 32;
  
  // Allocate WASM memory
  const blocksLen = blocks.length;
  const outputLen = numBlocks * BLOCK_SIZE;
  
  const allocStart = performance.now();
  const blocksPtr = wasmModule._malloc(blocksLen);
  const keyPtr = wasmModule._malloc(key.length);
  const ivPtr = wasmModule._malloc(iv.length);
  const outputPtr = wasmModule._malloc(outputLen);
  const allocTime = performance.now() - allocStart;
  
  try {
    // Copy data to WASM memory
    const copyStart = performance.now();
    wasmModule.HEAPU8.set(blocks, blocksPtr);
    wasmModule.HEAPU8.set(key, keyPtr);
    wasmModule.HEAPU8.set(iv, ivPtr);
    const copyTime = performance.now() - copyStart;
    
    // Expand key material (Emscripten exports with underscore prefix)
    const keyExpandStart = performance.now();
    const kmPtr = wasmModule._ruc_expand_key(keyPtr);
    const keyExpandTime = performance.now() - keyExpandStart;
    
    try {
      // Process blocks
      const startBlockNum = Number(startBlockNumber);
      const processStart = performance.now();
      
      if (encrypt) {
        if (encryptBatchFn) {
          encryptBatchFn(blocksPtr, numBlocks, keyPtr, ivPtr, startBlockNum, kmPtr, outputPtr);
        } else {
          wasmModule._ruc_encrypt_blocks_batch(
            blocksPtr,
            numBlocks,
            keyPtr,
            ivPtr,
            startBlockNum,
            kmPtr,
            outputPtr
          );
        }
      } else {
        if (decryptBatchFn) {
          decryptBatchFn(blocksPtr, numBlocks, keyPtr, ivPtr, startBlockNum, kmPtr, outputPtr);
        } else {
          wasmModule._ruc_decrypt_blocks_batch(
            blocksPtr,
            numBlocks,
            keyPtr,
            ivPtr,
            startBlockNum,
            kmPtr,
            outputPtr
          );
        }
      }
      
      const processTime = performance.now() - processStart;
      const mbProcessed = (blocksLen / 1024 / 1024);
      const mbPerSec = mbProcessed / (processTime / 1000);
      console.log(`  Worker: ${numBlocks} blocks, ${processTime.toFixed(2)}ms (${mbPerSec.toFixed(2)} MB/s)`);
      
      // Get profiling stats from WASM
      if (wasmModule._ruc_get_profile_stats) {
        const statsPtr = wasmModule._malloc(8 * 8); // 8 uint64_t values
        try {
          wasmModule._ruc_get_profile_stats(
            statsPtr,
            statsPtr + 8,
            statsPtr + 16,
            statsPtr + 24,
            statsPtr + 32,
            statsPtr + 40,
            statsPtr + 48,
            statsPtr + 56
          );
          
          const view = new DataView(wasmModule.HEAPU8.buffer, statsPtr, 64);
          const shake256Calls = Number(view.getBigUint64(0, true));
          const roundsExecuted = Number(view.getBigUint64(16, true));
          const selectorOrderingCalls = Number(view.getBigUint64(24, true));
          const keystreamCalls = Number(view.getBigUint64(32, true));
          const counterHashCalls = Number(view.getBigUint64(40, true));
          const gfMulCalls = Number(view.getBigUint64(48, true));
          const registerOpsCalls = Number(view.getBigUint64(56, true));
          
          if (processTime > 100) {
            console.log(`  📊 Profiling: SHAKE256=${shake256Calls}, Rounds=${roundsExecuted}, Selectors=${selectorOrderingCalls}, Keystream=${keystreamCalls}, Counter=${counterHashCalls}, GF=${gfMulCalls}, RegOps=${registerOpsCalls}`);
            console.log(`  📊 Per block: SHAKE256=${(shake256Calls/numBlocks).toFixed(1)}, Rounds=${(roundsExecuted/numBlocks).toFixed(1)}, GF=${(gfMulCalls/numBlocks).toFixed(0)}`);
          }
        } finally {
          wasmModule._free(statsPtr);
        }
      }
      
      // Copy output from WASM memory
      const outputStart = performance.now();
      const output = new Uint8Array(outputLen);
      output.set(wasmModule.HEAPU8.subarray(outputPtr, outputPtr + outputLen));
      const outputTime = performance.now() - outputStart;
      
      const totalTime = performance.now() - startTime;
      if (totalTime > 100) { // Only log if > 100ms
        console.log(`  Worker breakdown: alloc=${allocTime.toFixed(1)}ms, copy=${copyTime.toFixed(1)}ms, key=${keyExpandTime.toFixed(1)}ms, process=${processTime.toFixed(1)}ms, output=${outputTime.toFixed(1)}ms`);
      }
      
      return output;
    } finally {
      wasmModule._ruc_free_key_material(kmPtr);
    }
  } finally {
    wasmModule._free(blocksPtr);
    wasmModule._free(keyPtr);
    wasmModule._free(ivPtr);
    wasmModule._free(outputPtr);
  }
}

let wasmInitialized = false;

// Initialize WASM on worker startup
initWASM().then(() => {
  wasmInitialized = true;
  // Signal that worker is ready
  self.postMessage({
    type: 'success',
    id: 'ready',
  } as ParallelWorkerResponse);
}).catch((error) => {
  console.error('Worker WASM initialization failed:', error);
  wasmInitialized = false;
});

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<ParallelWorkerMessage>) => {
  const { type, id, blocks, startBlockNumber, numBlocks, key, iv } = event.data;
  
  // Ignore ready check messages
  if (id === 'ready') return;
  
  // Wait for WASM to be initialized if not ready yet
  if (!wasmInitialized) {
    await initWASM();
    wasmInitialized = true;
  }
  
  try {
    const result = await processBlocks(
      blocks,
      numBlocks,
      key,
      iv,
      startBlockNumber,
      type === 'encrypt'
    );
    
    // Use Transferable to avoid copying result back
    const transferList: Transferable[] = [];
    if (result.buffer instanceof ArrayBuffer) {
      transferList.push(result.buffer);
    }
    
    // The DOM lib types self as Window; in a worker the second argument is the transfer list.
    (self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void }).postMessage({
      type: 'success',
      id,
      data: result,
    } as ParallelWorkerResponse, transferList);
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: String(error),
    } as ParallelWorkerResponse);
  }
};

