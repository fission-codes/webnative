/**
 * Documentation for `@oddjs/odd`.
 *
 * ```
 * import * as fission from "@oddjs/odd/compositions/fission"
 * import * as odd from "@oddjs/odd"
 *
 * const config = { namespace: "odd-example" }
 *
 * odd.program(
 *   config,
 *   await fission.components(config)
 * )
 * ```
 * @module odd
 */

import * as Auth from "./auth.js"
import * as Events from "./events/program.js"
import * as Path from "./path/index.js"
import * as Cabinet from "./repositories/cabinet.js"

import { FileSystemQuery, Query } from "./authority/query.js"
import { CID } from "./common/cid.js"
import { Account } from "./components.js"
import { Components } from "./components.js"
import { AnnexParentType } from "./components/account/implementation.js"
import { RequestOptions } from "./components/authority/implementation.js"
import { Configuration, namespace } from "./configuration.js"
import { ListenTo, listenTo } from "./events/listen.js"
import { loadFileSystem } from "./fileSystem.js"
import { FileSystem } from "./fs/class.js"
import { addSampleData } from "./fs/data/sample.js"
import { Dictionary } from "./ucan/dictionary.js"
import { Ucan } from "./ucan/types.js"

////////////////
// RE-EXPORTS //
////////////////

export * from "./appInfo.js"
export * from "./common/types.js"
export * from "./common/version.js"
export * from "./configuration.js"
export * from "./fs/types.js"

export * as Components from "./components.js"

export * as authority from "./authority/query.js"
export * as events from "./events/index.js"
export * as path from "./path/index.js"
export * as ucan from "./ucan/index.js"

export { Channel, ChannelData, ChannelOptions } from "./channel.js"
export { CID, decodeCID, encodeCID } from "./common/cid.js"
export { RequestOptions } from "./components/authority/implementation.js"
export { CodecIdentifier } from "./dag/codecs.js"
export { FileSystem } from "./fs/class.js"
export { TransactionContext } from "./fs/transaction.js"
export { Dictionary as UcanDictionary } from "./ucan/dictionary.js"

///////////////////////
// TYPES & CONSTANTS //
///////////////////////

/**
 * The `Program` type.
 *
 * This will be your main interaction point with an ODD SDK program.
 * From here you can interact with the file system, manage your account,
 * and manage authority.
 *
 * The `Annex` type parameter is the type of `annex` part of the account
 * system implementation. Using a different account system could mean
 * you have different extensions located in the `program.account` object.
 *
 * @group 🚀
 */
export type Program<Annex extends Account.AnnexParentType, ChannelContext> =
  & {
    /**
     * {@inheritDoc AccountCategory}
     */
    account: AccountCategory<Annex>

    /**
     * {@inheritDoc AuthorityCategory}
     */
    authority: AuthorityCategory

    /**
     * Components used to build this program.
     */
    components: Components<Annex, ChannelContext>

    /**
     * Configuration used to build this program.
     */
    configuration: Configuration

    /**
     * {@inheritDoc FileSystemCategory}
     */
    fileSystem: FileSystemCategory

    /**
     * {@inheritDoc IdentityCategory}
     */
    identity: IdentityCategory
  }
  & ListenTo<Events.Program>

////////////////////////
// PROGRAM CATEGORIES //
////////////////////////

/**
 * Account system.
 *
 * @group Program
 */
export type AccountCategory<Annex extends AnnexParentType> = ReturnType<Account.Implementation<Annex>["annex"]> & {
  register: (formValues: Record<string, string>) => Promise<
    { registered: true } | { registered: false; reason: string }
  >
  canRegister: (formValues: Record<string, string>) => Promise<
    { canRegister: true } | { canRegister: false; reason: string }
  >
}

/**
 * Authority system.
 *
 * TODO: Unfinished
 *
 * @group Program
 */
export type AuthorityCategory = {
  /**
   * Does my program have the authority to work with these part of the file system?
   * And does the configured account system have the required authority?
   */
  has: (fileSystemQueries: Query | (Query | Query[])[]) => Promise<
    { has: true } | { has: false; reason: string }
  >

  provide: () => Promise<void>
  request: (options: RequestOptions) => Promise<void>
}

/**
 * File system.
 *
 * @group Program
 */
export type FileSystemCategory = {
  /**
   * Add some sample data to a file system.
   */
  addSampleData: (fs: FileSystem) => Promise<void>

  /**
   * Load a file system.
   *
   * ```
   * // Empty file system
   * program.fileSystem.load({ did: "did:some-identifier" })
   *
   * // Existing file system
   * program.fileSystem.load({ dataRoot: cid, did: "did:some-identifier" })
   *
   * // Existing file system that updates external data-root pointer when mutation occurs (and publishing is not disabled)
   * const updateFn = (dataRoot, proofs) => updateRemoteDataRoot(...)
   * program.fileSystem.load({ dataRoot: cid, dataRootUpdater: updateFn, did: "did:some-identifier" })
   * ```
   */
  load: (params: {
    dataRoot?: CID
    dataRootUpdater?: (
      dataRoot: CID,
      proofs: Ucan[]
    ) => Promise<{ updated: true } | { updated: false; reason: string }>
    did: string
  }) => Promise<FileSystem>
}

/**
 * Identity system.
 *
 * @group Program
 */
export type IdentityCategory = {
  account: () => Promise<string | null>
  agent: () => Promise<string>
  identifier: () => Promise<string>
}

//////////////////
// ENTRY POINTS //
//////////////////

/**
 * Build an ODD program.
 *
 * This will give you a `Program` object which will your main interaction point.
 *
 * This gives you three systems to work with:
 * - `account`, the account system, use this to register an account.
 * - `authority`, the authority system, request or provide authority to parts of (or the entire) file system and account system.
 * - `fileSystem`, the file system.
 *
 * An ODD program revolves around two main things, the file system (WNFS) and authorization (UCANs).
 * Both of these can be used entirely locally without depending on an external service.
 *
 * We've built components that can be swapped out with different
 * implementations. For example, the file system consists out of IPLD blocks,
 * how these blocks are stored and/or synced remotely is determined by the `depot` component.
 * You could have an implementation that just stores the blocks in memory and forgets
 * about them on page reload, or you could store the blocks in indexedDB and connect
 * to an IPFS peer that will fetch the blocks.
 *
 * @group 🚀
 */
export async function program<Annex extends AnnexParentType, ChannelContext>(
  config: Configuration,
  components: Components<Annex, ChannelContext>
): Promise<Program<Annex, ChannelContext>> {
  const { account, agent, identifier } = components

  // Is supported?
  await Promise.all(
    [components.storage].map(async component => {
      const result = await component.isSupported()
      if (!result.supported) throw new Error(result.reason)
    })
  )

  // Create repositories
  const cabinet = await Cabinet.create({ storage: components.storage })
  const ucanDictionary = new Dictionary(cabinet)

  cabinet.events.on("collection:changed", async ({ collection }) => {
    // TODO: emit authority:inventory-changed event
    // NOTE: This event exists so that UCANs can be stored encrypted on WNFS when using passkeys
  })

  // Authority
  const authority = {
    async has(
      query: Query | (Query | Query[])[]
    ): Promise<{ has: true } | { has: false; reason: string }> {
      const audience = await identifier.did()
      const queries = (Array.isArray(query) ? query : [query]).flat()

      // Account access
      if (queries.some(q => q.query === "account")) {
        const accountAccess = await account.hasSufficientAuthority(identifier, ucanDictionary)
        if (!accountAccess.suffices) {
          return {
            has: false,
            reason: accountAccess.reason,
          }
        }
      }

      // File system access
      const fsQueries = queries.reduce(
        (acc: FileSystemQuery[], q) => {
          if (q.query === "fileSystem") return [...acc, q]
          return acc
        },
        []
      )

      const hasAccessToFsPaths = fsQueries.filter(q => Path.isPartition("private", q.path)).reduce(
        (acc, query) => {
          if (acc === false) return false
          return cabinet.hasAccessKey(audience, query.path)
        },
        true
      )

      if (!hasAccessToFsPaths) {
        return {
          has: false,
          reason: "Program does not have write access to all the given paths.",
        }
      }

      // Fin
      return { has: true }
    },

    // TODO:
    async provide() {},
    async request() {},
  }

  // Categories
  const fileSystemCategory: Program<Annex, ChannelContext>["fileSystem"] = {
    addSampleData: (fs: FileSystem) => addSampleData(fs),
    load: async (params: {
      dataRoot?: CID
      dataRootUpdater?: (
        dataRoot: CID,
        proofs: Ucan[]
      ) => Promise<{ updated: true } | { updated: false; reason: string }>
      did: string
    }) => {
      const dataRoot = params.dataRoot
      const dataRootUpdater = params.dataRootUpdater
      const did = params.did

      return loadFileSystem({ cabinet, dataRoot, dataRootUpdater, dependencies: components, did })
    },
  }

  const identityCategory: Program<Annex, ChannelContext>["identity"] = {
    async account(): Promise<string | null> {
      return account.did(identifier, ucanDictionary)
    },
    async agent() {
      return agent.did()
    },
    async identifier() {
      return identifier.did()
    },
  }

  // Create `Program`
  const program = {
    ...listenTo(components.manners.program.eventEmitter),

    components,

    configuration: { ...config },

    // Categories
    authority,

    identity: identityCategory,
    fileSystem: fileSystemCategory,

    account: {
      register: Auth.register({ account, agent, identifier, cabinet }),
      canRegister: account.canRegister,

      ...components.account.annex(identifier, ucanDictionary),
    },
  }

  // Debug mode:
  // - Enable ODD extensions (if configured)
  // - Inject into global context (if configured)
  if (config.debug) {
    const inject = config.debug === true || config.debug?.injectIntoGlobalContext === undefined
      ? true
      : config.debug?.injectIntoGlobalContext

    if (inject) {
      const container = globalThis as any
      container.__odd = container.__odd || {}
      container.__odd.programs = container.__odd.programs || {}
      container.__odd.programs[namespace(config)] = program
    }

    // TODO: Re-enable extension
    //
    // const emitMessages = config.debugging?.emitWindowPostMessages === undefined
    //   ? true
    //   : config.debugging?.emitWindowPostMessages

    // if (emitMessages) {
    //   const { connect, disconnect } = await Extension.create({
    //     namespace: config.namespace,
    //     capabilities: config.permissions,
    //     dependencies: components,
    //     eventEmitters: {
    //       fileSystem: fsEvents
    //     }
    //   })

    //   const container = globalThis as any
    //   container.__odd = container.__odd || {}
    //   container.__odd.extension = container.__odd.extension || {}
    //   container.__odd.extension.connect = connect
    //   container.__odd.extension.disconnect = disconnect

    //   // Notify extension that the ODD SDK is ready
    //   globalThis.postMessage({
    //     id: "odd-devtools-ready-message",
    //   })
    // }
  }

  // Fin
  return program
}
