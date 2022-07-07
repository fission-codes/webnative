import localforage from "localforage"

import * as auth from "./auth/internal.js"
import * as cidLog from "./common/cid-log.js"
import * as common from "./common/index.js"
import * as dataRoot from "./data-root.js"
import * as pathing from "./path.js"
import * as ucan from "./ucan/internal.js"

import { InitialisationError } from "./init/types.js"
import { Permissions } from "./ucan/permissions.js"
import { validateSecrets } from "./auth/state.js"
import { bootstrapFileSystem, loadFileSystem } from "./filesystem.js"

import FileSystem from "./fs/index.js"

import { setImplementations } from "./setup.js"
import { BASE_IMPLEMENTATION } from "./auth/implementation/base.js"
import { USE_WNFS_IMPLEMENTATION } from "./auth/implementation/use-wnfs.js"
import { LOBBY_IMPLEMENTATION } from "./auth/implementation/lobby.js"
import { AppState } from "./auth/state/app.js"
import { LinkedAppState } from "./auth/state/linkedApp.js"
import * as appState from "./auth/state/app.js"
import * as fissionAppState from "./auth/state/linkedApp.js"


/** App with root authority 
 * 
 * Can do everything, needs no permission from other apps.
 * Opts-in to using WNFS.
*/
export async function app(options: { useWnfs: boolean }): Promise<AppState> {
  options = options || {}

  const { useWnfs = false } = options

  /**
   * Dependecy injected implementations are set internally. The developer does not
   * need to be aware of them unless they have an advanced use case.
  */
  if (useWnfs) {
    setImplementations(USE_WNFS_IMPLEMENTATION)
  } else {
    // We could eventually make the base implementation the default 
    // because it assumes the least of any implementation
    setImplementations(BASE_IMPLEMENTATION)
  }

  // Check if browser is supported
  if (globalThis.isSecureContext === false) throw InitialisationError.InsecureContext
  if (await isSupported() === false) throw InitialisationError.UnsupportedBrowser

  const authedUsername = await common.authenticatedUsername()

  if (authedUsername && useWnfs) {
    const dataCid = navigator.onLine ? await dataRoot.lookup(authedUsername) : null // data root on server or DNS
    const logCid = await cidLog.newest() // data root in browser
    const rootPermissions = { fs: { private: [pathing.root()], public: [pathing.root()] } }

    if (dataCid === null && logCid === undefined) {
      return appState.scenarioAuthed(
        authedUsername,
        await bootstrapFileSystem(rootPermissions)
      )
    } else {
      const fs = options.useWnfs === false ?
        undefined :
        await loadFileSystem(rootPermissions, authedUsername)

      return appState.scenarioAuthed(
        authedUsername,
        fs
      )
    }

  } else if (authedUsername) {
    return appState.scenarioAuthed(
      authedUsername,
      undefined
    )

  } else {
    return appState.scenarioNotAuthed()

  }
}


/** Rename existing initialize function
 * 
 * Not sure about the name! How do we name an app to make
 * it clear that it uses the Fission Auth Lobby?
 */
export async function fissionApp(options:
  {
    permissions?: Permissions

    // Options
    autoRemoveUrlParams?: boolean
    loadFileSystem?: boolean
    rootKey?: string
  }
): Promise<LinkedAppState> {
  options = options || {}

  const permissions = options.permissions || null
  const { rootKey } = options


  setImplementations(LOBBY_IMPLEMENTATION)

  const maybeLoadFs = async (username: string): Promise<undefined | FileSystem> => {
    return options.loadFileSystem === false
      ? undefined
      : await loadFileSystem(permissions, username, rootKey)
  }

  // Check if browser is supported
  if (globalThis.isSecureContext === false) throw InitialisationError.InsecureContext
  if (await isSupported() === false) throw InitialisationError.UnsupportedBrowser


  const state = await auth.init(options)

  // Allow auth implementation to return a State directly
  if (state && fissionAppState.isLinkedAppState(state)) {
    return state
  }

  const authedUsername = await common.authenticatedUsername()

  if (authedUsername && permissions) {
    const validSecrets = await validateSecrets(permissions)
    const validUcans = ucan.validatePermissions(permissions, authedUsername)

    if (validSecrets && validUcans) {
      return fissionAppState.scenarioContinuation(
        permissions,
        authedUsername,
        await maybeLoadFs(authedUsername)
      )
    } else {
      return fissionAppState.scenarioNotAuthorised(permissions)
    }

  } else if (authedUsername) {
    return fissionAppState.scenarioContinuation(
      permissions,
      authedUsername,
      await maybeLoadFs(authedUsername),
    )

  } else {
    return fissionAppState.scenarioNotAuthorised(permissions)

    
  }
}


/**
 * Alias for `fissionApp`.
 */
 export { fissionApp as initialise }
 export { fissionApp as initialize }



// SUPPORTED


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


// EXPORT


export * from "./auth.js"
export * from "./filesystem.js"
export * from "./common/version.js"

export const fs = FileSystem
export { AppScenario, AppState } from "./auth/state/app.js"
export { AuthCancelled, AuthSucceeded, Continuation, NotAuthorised } from "./auth/state/linkedApp.js"
export { Authed, NotAuthed } from "./auth/state/app.js"
export { LinkedAppScenario as Scenario, LinkedAppState as State } from "./auth/state/linkedApp.js"
export { InitialisationError, InitOptions } from "./init/types.js"

export * as account from "./auth/index.js"
export * as apps from "./apps/index.js"
export * as dataRoot from "./data-root.js"
export * as did from "./did/index.js"
export * as errors from "./errors.js"
export * as lobby from "./lobby/index.js"
export * as path from "./path.js"
export * as setup from "./setup.js"
export * as ucan from "./ucan/index.js"

export * as dns from "./dns/index.js"
export * as ipfs from "./ipfs/index.js"
export * as keystore from "./keystore.js"
export * as machinery from "./common/index.js"
export * as crypto from "./crypto/index.js"
