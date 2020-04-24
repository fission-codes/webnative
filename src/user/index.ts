import type { UserProperties } from './types'

import { API_ENDPOINT } from '../common'
import { FileSystem } from '../fs/filesystem'
import * as dns from '../common/dns'

import { USERNAME_BLACKLIST } from './blacklist'
import { didJWT, didKey } from './identity'

import ipfs, { CID } from '../ipfs'


/**
 * Create a user account.
 */
export const createAccount = async (
  userProps: UserProperties,
  apiEndpoint: string = API_ENDPOINT
): Promise<any> => {
  return fetch(`${apiEndpoint}/user`, {
    method: 'PUT',
    headers: {
      'authorization': `Bearer ${await didJWT()}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(userProps)
  })
}

/**
 * Get the CID of a user's data root.
 */
export const fileRoot = async (username: string): Promise<CID> => {
  try {
    // TODO: This'll be `files.${username}.fission.name` later
    return await dns.lookupDnsLink(`${username}.fission.name`)
  } catch(err) {
    throw new Error("Could not locate user root in dns")
  }
}

/**
 * Check if a username is available.
 */
export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  try {
    const resp = await fetch(`https://${username}.fission.name`, { method: "HEAD" })
    return resp.status >= 300
  } catch (_) {
    return true
  }
}

/**
 * Check if a username is valid.
 */
export const isUsernameValid = (username: string): boolean => {
  return !username.startsWith("-") &&
         !username.endsWith("-") &&
         !!username.match(/[a-zA-Z1-9-]+/) &&
         !USERNAME_BLACKLIST.includes(username)
}

/**
 * Update a user's data root.
 */
export const updateRoot = async (
  ffs: FileSystem,
  apiEndpoint: string = API_ENDPOINT
): Promise<any> => {
  const cid = await ffs.root.put()

  return fetch(`${apiEndpoint}/user/data/${cid}`, {
    method: 'PATCH',
    headers: {
      'authorization': `Bearer ${await didJWT()}`
    }
  })
}


export default {
  createAccount,
  didJWT,
  didKey,
  fileRoot,
  isUsernameAvailable,
  isUsernameValid,
  updateRoot
}
