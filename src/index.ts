import localforage from 'localforage'

import { USERNAME_STORAGE_KEY } from './common'
import { loadFileSystem } from './filesystem'
import FileSystem from './fs'

import * as auth from './auth'
import * as ucan from './ucan'
import * as ucan from './ucan/internal'
import { AppInfo, FileSystemPrerequisites } from './ucan/prerequisites'
import fsClass from './fs'



// SCENARIO


export type Scenario = {
  notAuthorised?: true,
  authSucceeded?: true,
  authCancelled?: true,
  continuation?: true,
}

export type FulfilledScenario = {
  scenario: Scenario,
  state: State
}



// STATE


export type State
  = NotAuthorised
  | AuthSucceeded
  | AuthCancelled
  | Continuation

export type NotAuthorised = {
  authenticated: false
}

export type AuthSucceeded = {
  authenticated: true
  newUser: boolean
  throughLobby: true
  username: string

  fs?: FileSystem
}

export type AuthCancelled = {
  authenticated: false
  cancellationReason: string
  throughLobby: true
}

export type Continuation = {
  authenticated: true
  newUser: false,
  throughLobby: false
  username: string

  fs?: FileSystem
}



// INTIALISE


/**
 * Check if we're authenticated, process any lobby query-parameters present in the URL,
 * and initiate the user's file system if authenticated (can be disabled).
 *
 * See `loadFileSystem` if you want to load the user's file system yourself.
 * NOTE: Only works on the main/ui thread, as it uses `window.location`.
 */
export async function initialise(
  options: {
    // Prerequisites
    app?: AppInfo,
    fs?: FileSystemPermissions,

    // Options
    autoRemoveUrlParams?: boolean
    loadFileSystem?: boolean
  }
): Promise<FulfilledScenario> {
  options = options || {}

  const maybeLoadFs = async (username: string): Promise<undefined | FileSystem> => {
    return options.loadFileSystem === false
      ? undefined
      : await loadFileSystem(username)
  }

  const { app, fs, autoRemoveUrlParams } = options
  const url = new URL(window.location.href)

  const cancellation = url.searchParams.get("cancelled")
  const ucans = url.searchParams.get("ucans")

  // Add UCANs to the storage
  await ucan.store(ucans.split(","))

  // Check if UCANs conform to the given prerequisites
  if (ucan.validatePrerequisites({ app, fs }) === false) {
    return scenarioNotAuthorised()
  }

  // Determine scenario
  if (ucans) {
    const newUser = url.searchParams.get("newUser") === "t"
    const username = url.searchParams.get("username") || ""

    await localforage.setItem(USERNAME_STORAGE_KEY, username)

    if (autoRemoveUrlParams || autoRemoveUrlParams === undefined) {
      url.searchParams.delete("newUser")
      url.searchParams.delete("ucans")
      url.searchParams.delete("username")
      history.replaceState(null, document.title, url.toString())
    }

    return scenarioAuthSucceeded(
      newUser,
      username,
      await maybeLoadFs(username)
    )

  } else if (cancellation) {
    const c = (_ => { switch (cancellation) {
      case "DENIED": return "User denied authorisation"
      default: return "Unknown reason"
    }})()

    return scenarioAuthCancelled(c)

  }

  const authedUsername = await auth.authenticatedUsername()

  return authedUsername
    ? scenarioContinuation(authedUsername, await maybeLoadFs(authedUsername))
    : scenarioNotAuthorised()
}


/**
 * Alias for `initialise`.
 */
export { initialise as initialize }



// EXPORT


export * from './auth'
export * from './filesystem'

export const fs = fsClass

export * as dataRoot from './data-root'
export * as did from './did'
export * as lobby from './lobby'
export * as setup from './setup'
export * as ucan from './ucan'

export * as dns from './dns'
export * as ipfs from './ipfs'
export * as keystore from './keystore'



// ㊙️


function scenarioAuthSucceeded(
  newUser: boolean,
  username: string,
  fs: FileSystem | undefined
): FulfilledScenario {
  return {
    scenario: { authSucceeded: true },
    state: {
      authenticated: true,
      throughLobby: true,
      fs,
      newUser,
      username
    }
  }
}

function scenarioAuthCancelled(
  cancellationReason: string
): FulfilledScenario {
  return {
    scenario: { authCancelled: true },
    state: {
      authenticated: false,
      throughLobby: true,
      cancellationReason
    }
  }
}

function scenarioContinuation(
  username: string,
  fs: FileSystem | undefined
): FulfilledScenario {
  return {
    scenario: { continuation: true },
    state: {
      authenticated: true,
      newUser: false,
      throughLobby: false,
      fs,
      username
    }
  }
}

function scenarioNotAuthorised(): FulfilledScenario {
  return {
    scenario: { notAuthorised: true },
    state: { authenticated: false }
  }
}
