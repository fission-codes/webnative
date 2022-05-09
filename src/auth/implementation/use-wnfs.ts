import * as base from "./base.js"
import * as check from "../../common/type-checks.js"
import * as did from "../../did/index.js"
import * as storage from "../../storage/index.js"
import * as ucanInternal from "../../ucan/internal.js"
import * as ucan from "../../ucan/token.js"
import { LinkingError } from "../linking.js"

export const delegateAccount = async (username: string, audience: string): Promise<Record<string, unknown>> => {
  const readKey = await storage.getItem("readKey")
  const proof = await storage.getItem("ucan") as string

  // UCAN
  const u = await ucan.build({
    audience,
    issuer: await did.write(),
    lifetimeInSeconds: 60 * 60 * 24 * 30 * 12 * 1000, // 1000 years
    potency: "SUPER_USER",
    proof,

    // TODO: UCAN v0.7.0
    // proofs: [ await localforage.getItem("ucan") ]
  })

  return { readKey, ucan: ucan.encode(u) }
}

function isUseWnfsLinkingData(data: unknown): data is { readKey: string; ucan: string } {
  return check.isObject(data)
    && "readKey" in data && typeof data.readKey === "string"
    && "ucan" in data && typeof data.ucan === "string"
}

export const linkDevice = async (data: Record<string, unknown>): Promise<void> => {
  if (!isUseWnfsLinkingData(data)) {
    throw new LinkingError(`Consumer received invalid link device response from producer: Expected read key and ucan, but got ${JSON.stringify(data)}`)
  }

  const { readKey, ucan: encodedToken } = data
  const u = ucan.decode(encodedToken as string)

  if (await ucan.isValid(u)) {
    await storage.setItem("ucan", encodedToken)
    await storage.setItem("readKey", readKey)

    // Create and store filesystem UCAN
    const issuer = await did.write()
    const fsUcan = await ucan.build({
      potency: "APPEND",
      resource: "*",
      proof: encodedToken,
      lifetimeInSeconds: 60 * 60 * 24 * 30 * 12 * 1000, // 1000 years

      audience: issuer,
      issuer
    })
    await ucanInternal.store([ucan.encode(fsUcan)])
  } else {
    throw new LinkingError(`Consumer received invalid link device response from producer. Given ucan is invalid: ${data.ucan}`)
  }
}



// 🛳


export const USE_WNFS_IMPLEMENTATION = {
  auth: {
    init: base.init,
    register: base.register,
    isUsernameValid: base.isUsernameValid,
    isUsernameAvailable: base.isUsernameAvailable,
    createChannel: base.createChannel,
    checkCapability: base.checkCapability,
    delegateAccount,
    linkDevice
  }
}