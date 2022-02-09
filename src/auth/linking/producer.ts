import aes from "keystore-idb/lib/aes/index.js"
import rsa from "keystore-idb/lib/rsa/index.js"
import utils from "keystore-idb/lib/utils.js"
import { KeyUse, SymmAlg, HashAlg, CharSize } from "keystore-idb/lib/types.js"
import * as did from "../../did/index.js"
import * as ucan from "../../ucan/index.js"
import * as auth from "../index.js"
import { EventEmitter } from "../../common/event-emitter"
import { LinkingError, LinkingWarning, handleLinkingError } from "../linking.js"

import type { Maybe, Result } from "../../common/index.js"
import type { EventListener } from "../../common/event-emitter"

type AccountLinkingProducer = {
  on: OnChallenge & OnLink & OnDone
  cancel: () => void
}

type OnChallenge = (
  event: "challenge",
  listener: (
    args: {
      pin: number[]
      confirmPin: () => void
      rejectPin: () => void
    }
  ) => void
) => void
type OnLink = (event: "link", listener: (args: { approved: boolean; username: string }) => void) => void
type OnDone = (event: "done", listener: () => void) => void

type LinkingStep = "BROADCAST" | "NEGOTIATION" | "DELEGATION"

type LinkingState = {
  username: Maybe<string>
  sessionKey: Maybe<CryptoKey>
  temporaryRsaPair: Maybe<CryptoKeyPair>
  step: Maybe<LinkingStep>
}

export const createProducer = async (options: { username: string; timeout?: number }): Promise<AccountLinkingProducer> => {
  const { username } = options
  let eventEmitter: Maybe<EventEmitter> = new EventEmitter()
  const ls: LinkingState = {
    username,
    sessionKey: null,
    temporaryRsaPair: null,
    step: "BROADCAST"
  }

  const handleMessage = async (event: MessageEvent): Promise<void> => {
    const { data } = event
    const message = new TextDecoder().decode(data.arrayBuffer ? await data.arrayBuffer() : data)
    console.debug("message (raw)", message)

    if (ls.step === "BROADCAST") {
      const { sessionKey, sessionKeyMessage } = await generateSessionKey(message)
      ls.sessionKey = sessionKey
      ls.step = "NEGOTIATION"
      channel.send(sessionKeyMessage)
    } else if (ls.step === "NEGOTIATION") {
      if (ls.sessionKey) {
        const userChallengeResult = await handleUserChallenge(ls.sessionKey, message)

        if (userChallengeResult.ok) {
          const { pin, audience } = userChallengeResult.value
          eventEmitter?.dispatchEvent("challenge",
            {
              pin,
              confirmPin: delegateAccount(ls.sessionKey, audience, finishDelegation),
              rejectPin: declineDelegation(ls.sessionKey, finishDelegation)
            })
        } else {
          handleLinkingError(userChallengeResult.error)
        }

      } else {
        handleLinkingError(new LinkingError("Producer missing session key when handling user challenge"))
      }
    } else if (ls.step === "DELEGATION") {
      // Noop
    }
  }

  const finishDelegation = async (delegationMessage: string, approved: boolean): Promise<void> => {
    await channel.send(delegationMessage)

    eventEmitter?.dispatchEvent("link", { approved, username: ls.username })
    resetLinkingState()
  }

  const resetLinkingState = () => {
    ls.sessionKey = null
    ls.temporaryRsaPair = null
    ls.step = "BROADCAST"
  }

  const cancel = async () => {
    eventEmitter?.dispatchEvent("done")
    eventEmitter = null
    resetLinkingState()
    channel.close()
  }

  const channel = await auth.createChannel({ username, handleMessage })

  return {
    on: (event: string, listener: EventListener) => { eventEmitter?.addEventListener(event, listener) },
    cancel
  }
}


/**
 * BROADCAST
 * 
 * This should be called by the PRODUCER upon receiving the throwaway DID key.
 * 
 * @param didThrowaway 
 * @returns session key and session key message for CONSUMER
 */
export const generateSessionKey = async (didThrowaway: string): Promise<{ sessionKey: CryptoKey; sessionKeyMessage: string }> => {
  const sessionKey = await aes.makeKey({ alg: SymmAlg.AES_GCM, length: 256 })

  const exportedSessionKey = await aes.exportKey(sessionKey)

  const { publicKey } = did.didToPublicKey(didThrowaway)
  const publicCryptoKey = await rsa.importPublicKey(publicKey, HashAlg.SHA_256, KeyUse.Exchange)

  // Note: rsa.encrypt expects a B16 string
  const rawSessionKey = utils.arrBufToStr(utils.base64ToArrBuf(exportedSessionKey), CharSize.B16)
  const encryptedSessionKey = await rsa.encrypt(rawSessionKey, publicCryptoKey)

  const u = await ucan.build({
    issuer: await did.ucan(),
    audience: didThrowaway,
    lifetimeInSeconds: 60 * 5, // 5 minutes
    facts: [{ sessionKey: exportedSessionKey }],
    potency: null
  })

  const iv = utils.randomBuf(16)
  const msg = await aes.encrypt(ucan.encode(u), sessionKey, { iv, alg: SymmAlg.AES_GCM })

  const sessionKeyMessage = JSON.stringify({
    iv: utils.arrBufToBase64(iv),
    msg,
    sessionKey: utils.arrBufToBase64(encryptedSessionKey)
  })

  return {
    sessionKey,
    sessionKeyMessage
  }
}


/**
 * NEGOTIATION
 * 
 * PRODUCER receives the DID & challenge PIN from the CONSUMER.
 * 
 * @param data 
 * @returns pin and audience
 */
const handleUserChallenge = async (sessionKey: CryptoKey, data: string): Promise<Result<{ pin: number[]; audience: string }, Error>> => {
  const { iv, msg } = JSON.parse(data)

  if (!iv) {
    return { ok: false, error: new LinkingError("Producer could not handle user challenge message because `iv` was missing") }
  }

  let message = null
  try {
    message = await aes.decrypt(msg, sessionKey, {
      alg: SymmAlg.AES_GCM,
      iv
    })
  } catch (_) {
    return { ok: false, error: new LinkingWarning("Ignoring message that could not be decrypted.") }
  }

  const json = JSON.parse(message)
  const pin = Object.values(json.pin) as number[] ?? null
  const audience = json.did as string ?? null

  if (pin !== null && audience !== null) {
    return { ok: true, value: { pin, audience } }
  } else {
    return { ok: false, error: new LinkingError(`Proucer received invalid pin ${json.pin} or audience ${json.audience}`) }
  }
}


/**
 * DELEGATION: Delegate account
 * 
 * This step is user initiated when a user confirms a pin
 * The dependency injected auth.delegateAccount creates a UCAN with delegate rights and any other keys for the CONSUMER. 
 * 
 * @param audience
 * @returns
 */
const delegateAccount = (
  sessionKey: CryptoKey,
  audience: string,
  finishDelegation: (delegationMessage: string, approved: boolean) => Promise<void>
): () => Promise<void> => {
  return async function () {
    const delegation = await auth.delegateAccount(audience)
    const message = JSON.stringify({ linkStatus: "APPROVED", delegation })

    const iv = utils.randomBuf(16)
    const msg = await aes.encrypt(message, sessionKey, { iv, alg: SymmAlg.AES_GCM })

    const delegationMessage = JSON.stringify({
      iv: utils.arrBufToBase64(iv),
      msg
    })

    await finishDelegation(delegationMessage, true)
  }
}

/**
 * DELEGATION: Decline delegation
 *
 * This step is user initiated when a user rejects a pin
 *
 * @param
 * @returns
 */
const declineDelegation = (
  sessionKey: CryptoKey,
  finishDelegation: (delegationMessage: string, approved: boolean) => Promise<void>
): () => Promise<void> => {
  return async function () {
    const message = JSON.stringify({ linkStatus: "DENIED" })

    const iv = utils.randomBuf(16)
    const msg = await aes.encrypt(message, sessionKey, { iv, alg: SymmAlg.AES_GCM })

    const delegationMessage = JSON.stringify({
      iv: utils.arrBufToBase64(iv),
      msg
    })

    await finishDelegation(delegationMessage, true)
  }
}