import type { Implementation, ImplementationOptions } from "../implementation.js"
import * as FileSystem from "../../../fs/types.js"
import { addSampleData } from "../../../fs/sample.js"


// 🛳


export function implementation(opts: ImplementationOptions): Implementation {
  return {
    log: opts.configuration.debug ? console.log : () => { },
    warn: opts.configuration.debug ? console.warn : () => { },

    // WASM
    wnfsWasmLookup: wnfsVersion => fetch(`https://unpkg.com/wnfs@${wnfsVersion}/wasm_wnfs_bg.wasm`),

    // File system
    fileSystem: {
      hooks: {
        afterLoadExisting: (fs: FileSystem.API) => addSampleData(fs),
        afterLoadNew: async (fs: FileSystem.API) => { },
        beforeLoadExisting: async () => { },
        beforeLoadNew: async () => { },
      },
    },
  }
}