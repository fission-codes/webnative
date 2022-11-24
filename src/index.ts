/*

    %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
@@@@@%     %@@@@@@%         %@@@@@@@%     %@@@@@
@@@@@       @@@@@%            @@@@@@       @@@@@
@@@@@%      @@@@@             %@@@@@      %@@@@@
@@@@@@%     @@@@@     %@@%     @@@@@     %@@@@@@
@@@@@@@     @@@@@    %@@@@%    @@@@@     @@@@@@@
@@@@@@@     @@@@%    @@@@@@    @@@@@     @@@@@@@
@@@@@@@    %@@@@     @@@@@@    @@@@@%    @@@@@@@
@@@@@@@    @@@@@     @@@@@@    %@@@@@    @@@@@@@
@@@@@@@    @@@@@@@@@@@@@@@@     @@@@@    @@@@@@@
@@@@@@@    %@@@@@@@@@@@@@@@     @@@@%    @@@@@@@
@@@@@@@     %@@%     @@@@@@     %@@%     @@@@@@@
@@@@@@@              @@@@@@              @@@@@@@
@@@@@@@%            %@@@@@@%            %@@@@@@@
@@@@@@@@@%        %@@@@@@@@@@%        %@@@@@@@@@
%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%

 */

import * as Uint8arrays from "uint8arrays"
import localforage from "localforage"

import * as Auth from "./components/auth/implementation.js"
import * as CapabilitiesImpl from "./components/capabilities/implementation.js"
import * as Capabilities from "./capabilities.js"
import * as Crypto from "./components/crypto/implementation.js"
import * as Depot from "./components/depot/implementation.js"
import * as Manners from "./components/manners/implementation.js"
import * as Reference from "./components/reference/implementation.js"
import * as RootKey from "./common/root-key.js"
import * as SessionMod from "./session.js"
import * as Storage from "./components/storage/implementation.js"
import * as Ucan from "./ucan/index.js"

import { SESSION_TYPE as CAPABILITIES_SESSION_TYPE } from "./capabilities.js"
import { TYPE as WEB_CRYPTO_SESSION_TYPE } from "./components/auth/implementation/base.js"
import { AccountLinkingConsumer, AccountLinkingProducer, createConsumer, createProducer } from "./linking/index.js"
import { Components } from "./components.js"
import { Configuration, namespaceToString } from "./configuration.js"
import { isString, Maybe } from "./common/index.js"
import { Session } from "./session.js"
import { appId, AppInfo } from "./permissions.js"
import { loadFileSystem, loadRootFileSystem } from "./filesystem.js"
import FileSystem from "./fs/filesystem.js"


// IMPLEMENTATIONS

import * as BaseAuth from "./components/auth/implementation/base.js"
import * as BaseReference from "./components/reference/implementation/base.js"
import * as BrowserCrypto from "./components/crypto/implementation/browser.js"
import * as BrowserStorage from "./components/storage/implementation/browser.js"
import * as FissionIpfsProduction from "./components/depot/implementation/fission-ipfs-production.js"
import * as FissionIpfsStaging from "./components/depot/implementation/fission-ipfs-staging.js"
import * as FissionAuthBaseProduction from "./components/auth/implementation/fission-base-production.js"
import * as FissionAuthBaseStaging from "./components/auth/implementation/fission-base-staging.js"
import * as FissionAuthWnfsProduction from "./components/auth/implementation/fission-wnfs-production.js"
import * as FissionAuthWnfsStaging from "./components/auth/implementation/fission-wnfs-staging.js"
import * as FissionLobbyBase from "./components/capabilities/implementation/fission-lobby.js"
import * as FissionLobbyProduction from "./components/capabilities/implementation/fission-lobby-production.js"
import * as FissionLobbyStaging from "./components/capabilities/implementation/fission-lobby-staging.js"
import * as FissionReferenceProduction from "./components/reference/implementation/fission-production.js"
import * as FissionReferenceStaging from "./components/reference/implementation/fission-staging.js"
import * as ProperManners from "./components/manners/implementation/base.js"


// RE-EXPORTS


export * from "./components.js"
export * from "./configuration.js"
export * from "./common/types.js"
export * from "./common/version.js"
export * from "./permissions.js"

export * as did from "./did/index.js"
export * as path from "./path/index.js"
export * as ucan from "./ucan/index.js"

export { AccountLinkingConsumer, AccountLinkingProducer } from "./linking/index.js"
export { Capabilities, FileSystemSecret } from "./capabilities.js"
export { FileSystem } from "./fs/filesystem.js"
export { Session } from "./session.js"



// TYPES & CONSTANTS


export type AuthenticationStrategy = {
  implementation: Auth.Implementation<Components>

  accountConsumer: (username: string) => Promise<AccountLinkingConsumer>
  accountProducer: (username: string) => Promise<AccountLinkingProducer>
  isUsernameAvailable: (username: string) => Promise<boolean>
  isUsernameValid: (username: string) => Promise<boolean>
  register: (options: { username: string; email?: string }) => Promise<{ success: boolean }>
  session: () => Promise<Maybe<Session>>
}


export type Program = ShortHands & {
  auth: AuthenticationStrategy
  capabilities: {
    collect: () => Promise<Maybe<string>> // returns username
    request: () => Promise<void>
    session: (username: string) => Promise<Maybe<Session>>
  }
  components: Components
  session: Maybe<Session>
}


export enum ProgramError {
  InsecureContext = "INSECURE_CONTEXT",
  UnsupportedBrowser = "UNSUPPORTED_BROWSER"
}


export type ShortHands = {
  loadFileSystem: (username: string) => Promise<FileSystem>
  loadRootFileSystem: (username: string) => Promise<FileSystem>
}



// ENTRY POINTS


/**
 * Build a webnative program.
 *
 * This will give you a `Program` object which has the following properties:
 * - `session`, a `Session` object if a session was created before.
 * - `auth`, a means to control the various auth strategies you configured. Use this to create sessions. Read more about auth components in the toplevel `auth` object documention.
 * - `capabilities`, a means to control capabilities. Use this to collect & request capabilities, and to create a session based on them. Read more about capabilities in the toplevel `capabilities` object documentation.
 * - `components`, your full set of `Components`.
 *
 * This object also has a few other functions, for example to load a filesystem.
 * These are called "shorthands" because they're the same functions available
 * through other places in webnative, but you don't have to pass in the components.
 *
 * See `assemble` for more information.
 */
export async function program(settings: Partial<Components> & Configuration): Promise<Program> {
  if (!settings) throw new Error("Expected a settings object of the type `Partial<Components> & Configuration` as the first parameter")

  const components = await gatherComponents(settings)
  return assemble(settings, components)
}



// PREDEFINED COMPONENT COMBINATIONS


/**
 * Predefined auth configurations.
 *
 * This component goes hand in hand with the "reference" and "depot" components.
 * The "auth" component registers a DID and the reference looks it up.
 * The reference component also manages the "data root", the pointer to an account's entire filesystem.
 * The depot component is responsible for getting data to and from the other side.
 *
 * For example, using the Fission architecture, when a data root is updated on the Fission server,
 * the server fetches the data from the depot in your app.
 *
 * So if you want to build a service independent of Fission's infrastructure,
 * you will need to write your own reference and depot implementations (see source code).
 *
 * NOTE: If you're using a non-default component, you'll want to pass that in here as a parameter as well.
 *       Dependents: crypto, manners, reference, storage.
 */
export const auth = {
  /**
   * A standalone authentication system that uses the browser's Web Crypto API
   * to create an identity based on a RSA key-pair.
   *
   * NOTE: This uses a Fission server to register an account (DID).
   *       Check out the `wnfs` and `base` auth implementations if
   *       you want to build something without the Fission infrastructure.
   */
  async fissionWebCrypto(settings: Configuration & {
    disableWnfs?: boolean
    staging?: boolean

    // Dependents
    crypto?: Crypto.Implementation
    manners?: Manners.Implementation
    reference?: Reference.Implementation
    storage?: Storage.Implementation
  }): Promise<Auth.Implementation<Components>> {
    const { disableWnfs, staging } = settings

    const manners = settings.manners || defaultMannersComponent(settings)
    const crypto = settings.crypto || await defaultCryptoComponent(settings.namespace)
    const storage = settings.storage || defaultStorageComponent(settings.namespace)
    const reference = settings.reference || await defaultReferenceComponent({ crypto, manners, storage })

    if (disableWnfs) {
      if (staging) return FissionAuthBaseStaging.implementation({ crypto, reference, storage })
      return FissionAuthBaseProduction.implementation({ crypto, reference, storage })
    } else {
      if (staging) return FissionAuthWnfsStaging.implementation({ crypto, reference, storage })
      return FissionAuthWnfsProduction.implementation({ crypto, reference, storage })
    }
  }
}

/**
 * Predefined capabilities configurations.
 *
 * If you want partial read and/or write access to the filesystem you'll want
 * a "capabilities" component. This component is responsible for requesting
 * and receiving UCANs, read keys and namefilters from other sources to enable this.
 *
 * NOTE: If you're using a non-default component, you'll want to pass that in here as a parameter as well.
 *       Dependents: crypto, depot.
 */
export const capabilities = {
  /**
   * A secure enclave in the form of a webnative app which serves as the root authority.
   * Your app is redirected to the lobby where the user can create an account or link a device,
   * and then request permissions from the user for reading or write to specific parts of the filesystem.
   */
  async fissionLobby(settings: Configuration & {
    staging?: boolean

    // Dependents
    crypto?: Crypto.Implementation
    depot?: Depot.Implementation
  }): Promise<CapabilitiesImpl.Implementation> {
    const { staging } = settings

    const crypto = settings.crypto || await defaultCryptoComponent(settings.namespace)
    const depot = settings.depot || await defaultDepotComponent(settings.namespace)

    if (staging) return FissionLobbyStaging.implementation({ crypto, depot })
    return FissionLobbyProduction.implementation({ crypto, depot })
  }
}

/**
 * Predefined depot configurations.
 *
 * The depot component gets data in and out your program.
 * For example, say I want to load and then update a file system.
 * The depot will get that file system data for me,
 * and after updating it, send the data to where it needs to be.
 */
export const depot = {
  /**
   * This depot uses IPFS and the Fission servers.
   * The data is transferred to the Fission IPFS node,
   * where all of your encrypted and public data lives.
   * Other webnative programs with this depot fetch the data from there.
   */
  async fissionIPFS(
    settings: Configuration & { staging?: boolean }
  ): Promise<Depot.Implementation> {
    const repoName = `${namespaceToString(settings.namespace)}/ipfs`
    if (settings.staging) return FissionIpfsStaging.implementation(repoName)
    return FissionIpfsProduction.implementation(repoName)
  }
}


/**
 * Predefined reference configurations.
 *
 * The reference component is responsible for looking up and updating various pointers.
 * Specifically, the data root, a user's DID root, DNSLinks, DNS TXT records.
 * It also holds repositories (see `Repository` class), which contain UCANs and CIDs.
 *
 * NOTE: If you're using a non-default component, you'll want to pass that in here as a parameter as well.
 *       Dependents: crypto, manners, storage.
 */
export const reference = {
  /**
   * Use the Fission servers as your reference.
   */
  async fission(settings: Configuration & {
    staging?: boolean

    // Dependents
    crypto?: Crypto.Implementation
    manners?: Manners.Implementation
    storage?: Storage.Implementation
  }): Promise<Reference.Implementation> {
    const { staging } = settings

    const manners = settings.manners || defaultMannersComponent(settings)
    const crypto = settings.crypto || await defaultCryptoComponent(settings.namespace)
    const storage = settings.storage || defaultStorageComponent(settings.namespace)

    if (staging) return FissionReferenceStaging.implementation({ crypto, manners, storage })
    return FissionReferenceProduction.implementation({ crypto, manners, storage })
  }
}



// ASSEMBLE


/**
 * Build a Webnative Program based on a given set of `Components`.
 * These are various customisable components that determine how a Webnative app works.
 * Use `program` to work with a default, or partial, set of components.
 *
 * Additionally this does a few other things:
 * - Checks if the browser is supported.
 * - Restores a session if one was made before and loads the user's file system if needed.
 * - Attempts to collect capabilities if the configuration has permissions.
 * - Provides shorthands to functions so you don't have to pass in components.
 * - Ensure backwards compatibility with older Webnative clients.
 *
 * See `loadFileSystem` if you want to load the user's file system yourself.
 */
export async function assemble(config: Configuration, components: Components): Promise<Program> {
  const permissions = config.permissions

  // Check if browser is supported
  if (globalThis.isSecureContext === false) throw ProgramError.InsecureContext
  if (await isSupported() === false) throw ProgramError.UnsupportedBrowser

  // Backwards compatibility (data)
  await ensureBackwardsCompatibility(components, config)

  // Authenticated user
  const sessionInfo = await SessionMod.restore(components.storage)

  // Auth implementations
  const auth: AuthenticationStrategy = (method => {
    return {
      implementation: method,

      accountConsumer(username: string) {
        return createConsumer(
          { auth: method, crypto: components.crypto, manners: components.manners },
          { username }
        )
      },

      accountProducer(username: string) {
        return createProducer(
          { auth: method, crypto: components.crypto, manners: components.manners },
          { username }
        )
      },

      isUsernameAvailable: method.isUsernameAvailable,
      isUsernameValid: method.isUsernameValid,
      register: method.register,

      async session(): Promise<Maybe<Session>> {
        const newSessionInfo = await SessionMod.restore(components.storage)
        if (!newSessionInfo) return null

        return this.implementation.activate(
          components,
          newSessionInfo.username,
          config
        )
      }
    }
  })(components.auth)

  // Capabilities
  const capabilities = {
    async collect() {
      const c = await components.capabilities.collect()
      if (!c) return null

      await Capabilities.collect({
        capabilities: c,
        crypto: components.crypto,
        reference: components.reference,
        storage: components.storage
      })

      return c.username
    },
    request() {
      return components.capabilities.request({
        permissions
      })
    },
    async session(username: string) {
      const ucan = Capabilities.validatePermissions(
        components.reference.repositories.ucans,
        permissions || {}
      )

      if (!ucan) {
        console.warn("The present UCANs did not satisfy the configured permissions.")
        return null
      }

      const accountDID = Ucan.rootIssuer(ucan)
      const validSecrets = await Capabilities.validateSecrets(
        components.crypto,
        accountDID,
        permissions || {}
      )

      if (!validSecrets) {
        console.warn("The present filesystem secrets did not satisfy the configured permissions.")
        return null
      }

      await SessionMod.provide(components.storage, { type: CAPABILITIES_SESSION_TYPE, username })

      const fs = config.fileSystem?.loadImmediately === false ?
        undefined :
        await loadFileSystem({
          config,
          dependents: components,
          username,
        })

      return new Session({
        fs,
        username,
        crypto: components.crypto,
        storage: components.storage,
        type: CAPABILITIES_SESSION_TYPE,
      })
    }
  }

  // Session
  let session = null

  if (isCapabilityBasedAuthConfiguration(config)) {
    const username = await capabilities.collect()
    if (username) session = await capabilities.session(username)
    if (sessionInfo && sessionInfo.type === CAPABILITIES_SESSION_TYPE) session = await capabilities.session(sessionInfo.username)

  } else if (sessionInfo && sessionInfo.type !== CAPABILITIES_SESSION_TYPE) {
    session = await auth.session()

  }

  // Shorthands
  const shorthands: ShortHands = {
    loadFileSystem: (username: string) => loadFileSystem({ config, username, dependents: components }),
    loadRootFileSystem: (username: string) => loadRootFileSystem({ config, username, dependents: components }),
  }

  // Fin
  return {
    ...shorthands,
    auth,
    components,
    capabilities,
    session,
  }
}



// COMPOSITIONS


/**
 * Full component sets.
 */
export const compositions = {
  /**
   * The default Fission stack using web crypto auth.
   */
  async fission(settings: Configuration & {
    disableWnfs?: boolean
    staging?: boolean

    // Dependents
    crypto?: Crypto.Implementation
    manners?: Manners.Implementation
    storage?: Storage.Implementation
  }): Promise<Components> {
    const crypto = settings.crypto || await defaultCryptoComponent(settings.namespace)
    const manners = settings.manners || defaultMannersComponent(settings)
    const storage = settings.storage || defaultStorageComponent(settings.namespace)

    const settingsWithComponents = { ...settings, crypto, manners, storage }

    const r = await reference.fission(settingsWithComponents)
    const d = await depot.fissionIPFS(settingsWithComponents)
    const c = await capabilities.fissionLobby({ ...settingsWithComponents, depot: d })
    const a = await auth.fissionWebCrypto({ ...settingsWithComponents, reference: r })

    return {
      auth: a,
      capabilities: c,
      depot: d,
      reference: r,
      crypto,
      manners,
      storage,
    }
  }
}


export async function gatherComponents(setup: Partial<Components> & Configuration): Promise<Components> {
  const config = extractConfig(setup)

  const crypto = setup.crypto || await defaultCryptoComponent(config.namespace)
  const manners = setup.manners || defaultMannersComponent(config)
  const storage = setup.storage || defaultStorageComponent(config.namespace)

  const reference = setup.reference || await defaultReferenceComponent({ crypto, manners, storage })
  const depot = setup.depot || await defaultDepotComponent(config.namespace)
  const capabilities = setup.capabilities || defaultCapabilitiesComponent({ crypto, depot })
  const auth = setup.auth || defaultAuthComponent({ crypto, reference, storage })

  return {
    auth,
    capabilities,
    crypto,
    depot,
    manners,
    reference,
    storage,
  }
}



// DEFAULT COMPONENTS


export function defaultAuthComponent({ crypto, reference, storage }: BaseAuth.Dependents): Auth.Implementation<Components> {
  return FissionAuthWnfsProduction.implementation({
    crypto, reference, storage,
  })
}

export function defaultCapabilitiesComponent({ crypto, depot }: FissionLobbyBase.Dependents): CapabilitiesImpl.Implementation {
  return FissionLobbyProduction.implementation({ crypto, depot })
}

export function defaultCryptoComponent(namespace: string | AppInfo): Promise<Crypto.Implementation> {
  return BrowserCrypto.implementation({
    storeName: namespaceToString(namespace),
    exchangeKeyName: "exchange-key",
    writeKeyName: "write-key"
  })
}

export function defaultDepotComponent(namespace: string | AppInfo): Promise<Depot.Implementation> {
  return FissionIpfsProduction.implementation(
    `${namespaceToString(namespace)}/ipfs`
  )
}

export function defaultMannersComponent(config: Configuration): Manners.Implementation {
  return ProperManners.implementation({
    configuration: config
  })
}

export function defaultReferenceComponent({ crypto, manners, storage }: BaseReference.Dependents): Promise<Reference.Implementation> {
  return FissionReferenceProduction.implementation({
    crypto,
    manners,
    storage,
  })
}

export function defaultStorageComponent(namespace: string | AppInfo): Storage.Implementation {
  return BrowserStorage.implementation({
    name: namespaceToString(namespace)
  })
}



// 🛟


/**
 * Is this browser supported?
 */
export async function isSupported(): Promise<boolean> {
  return localforage.supports(localforage.INDEXEDDB)

    // Firefox in private mode can't use indexedDB properly,
    // so we test if we can actually make a database.
    && await (() => new Promise(resolve => {
      const db = indexedDB.open("testDatabase")
      db.onsuccess = () => resolve(true)
      db.onerror = () => resolve(false)
    }))() as boolean
}



// BACKWARDS COMPAT


async function ensureBackwardsCompatibility(components: Components, config: Configuration): Promise<void> {
  // Old pieces:
  // - Key pairs: IndexedDB → keystore → exchange-key & write-key
  // - UCAN used for account linking/delegation: IndexedDB → localforage → ucan
  // - Root read key of the filesystem: IndexedDB → localforage → readKey
  // - Authenticated username: IndexedDB → localforage → webnative.auth_username

  const [ migK, migV ] = [ "migrated", "true" ]

  // If already migrated, stop here.
  const migrationOccurred = await components.storage.getItem(migK) === migV
  if (migrationOccurred) return

  // Only try to migrate if environment supports indexedDB
  if (!window.indexedDB) return

  // Migration
  const keystoreDB = await bwOpenDatabase("keystore")

  if (keystoreDB) {
    const exchangeKeyPair = await bwGetValue(keystoreDB, "keyvaluepairs", "exchange-key")
    const writeKeyPair = await bwGetValue(keystoreDB, "keyvaluepairs", "write-key")

    if (exchangeKeyPair && writeKeyPair) {
      await components.storage.setItem("exchange-key", exchangeKeyPair)
      await components.storage.setItem("write-key", writeKeyPair)
    }
  }

  const localforageDB = await bwOpenDatabase("localforage")

  if (localforageDB) {
    const accountUcan = await bwGetValue(localforageDB, "keyvaluepairs", "ucan")
    const permissionedUcans = await bwGetValue(localforageDB, "keyvaluepairs", "webnative.auth_ucans")
    const rootKey = await bwGetValue(localforageDB, "keyvaluepairs", "readKey")
    const authedUser = await bwGetValue(localforageDB, "keyvaluepairs", "webnative.auth_username")

    if (rootKey && isString(rootKey)) {
      const anyUcan = accountUcan || (Array.isArray(permissionedUcans) ? permissionedUcans[ 0 ] : undefined)
      const accountDID = anyUcan ? Ucan.rootIssuer(anyUcan) : null
      if (!accountDID) throw new Error("Failed to retrieve account DID")

      await RootKey.store({
        accountDID,
        crypto: components.crypto,
        readKey: Uint8arrays.fromString(rootKey, "base64pad"),
      })
    }

    if (accountUcan) {
      await components.storage.setItem(
        components.storage.KEYS.ACCOUNT_UCAN,
        accountUcan
      )
    }

    if (authedUser) {
      await components.storage.setItem(
        components.storage.KEYS.SESSION,
        JSON.stringify({
          type: isCapabilityBasedAuthConfiguration(config) ? CAPABILITIES_SESSION_TYPE : WEB_CRYPTO_SESSION_TYPE,
          username: authedUser
        })
      )
    }
  }

  await components.storage.setItem(migK, migV)
}


function bwGetValue(db: IDBDatabase, storeName: string, key: string): Promise<Maybe<unknown>> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve(null)

    const transaction = db.transaction([ storeName ], "readonly")
    const store = transaction.objectStore(storeName)
    const req = store.get(key)

    req.onerror = () => {
      // No store, moving on.
      resolve(null)
    }

    req.onsuccess = () => {
      resolve(req.result)
    }
  })
}


function bwOpenDatabase(name: string): Promise<Maybe<IDBDatabase>> {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(name)

    req.onerror = () => {
      // No database, moving on.
      resolve(null)
    }

    req.onsuccess = () => {
      resolve(req.result)
    }
  })
}



// 🛠


export function extractConfig(opts: Partial<Components> & Configuration): Configuration {
  return {
    namespace: opts.namespace,
    debug: opts.debug,
    fileSystem: opts.fileSystem,
    userMessages: opts.userMessages,
  }
}


/**
 * Is this a configuration that uses capabilities?
 */
export function isCapabilityBasedAuthConfiguration(config: Configuration): boolean {
  return !!config.permissions
}
