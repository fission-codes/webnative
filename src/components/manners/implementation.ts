import type { Configuration } from "../../configuration.js"
import * as FileSystem from "../../fs/types.js"


export type ImplementationOptions = {
  configuration: Configuration
}


export type Implementation = {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void

  /**
   * Configure how the wnfs wasm module should be loaded.
   *
   * This only has an effect if you're using file systems of version 3 or higher.
   *
   * By default this loads the required version of the wasm wnfs module from unpkg.com.
   */
  wnfsWasmLookup: (wnfsVersion: string) => Promise<BufferSource | Response>

  /**
   * File system.
   */
  fileSystem: {
    /**
     * Various file system hooks.
     */
    hooks: {
      afterLoadExisting: (fs: FileSystem.API) => Promise<void>
      afterLoadNew: (fs: FileSystem.API) => Promise<void>
      beforeLoadExisting: () => Promise<void>
      beforeLoadNew: () => Promise<void>
    }
  }
}