import * as Ucans from "@ucans/core"
import * as Raw from "multiformats/codecs/raw"
import * as Uint8arrays from "uint8arrays"

import * as ECDSA from "iso-signatures/verifiers/ecdsa"
import * as EDDSA from "iso-signatures/verifiers/eddsa"
import { Resolver } from "iso-signatures/verifiers/resolver"
import * as RSA from "iso-signatures/verifiers/rsa"

import { Ucan } from "@ucans/core"
import { DIDKey } from "iso-did/key"
import { sha256 } from "multiformats/hashes/sha2"

import * as AgentDID from "../agent/did.js"
import * as Agent from "../components/agent/implementation.js"

import { CID } from "../common/cid.js"
import { BuildParams, Keypair } from "./types.js"

export { encode, encodeHeader, encodePayload, isExpired, isTooEarly, parse, verify } from "@ucans/core"
export * from "./types.js"

// 🛠️

export async function build(
  params: BuildParams
): Promise<Ucan> {
  return Ucans.build(
    await plugins()
  )(
    params
  )
}

export async function cid(ucan: Ucan): Promise<CID> {
  const ucanString = Ucans.encode(ucan)
  const multihash = await sha256.digest(
    Uint8arrays.fromString(ucanString, "utf8")
  )

  return CID.createV1(Raw.code, multihash)
}

export function decode(encoded: string): Ucan {
  const [encodedHeader, encodedPayload, signature] = encoded.split(".")
  const parts = Ucans.parse(encoded)

  return {
    header: parts.header,
    payload: parts.payload,
    signedData: `${encodedHeader}.${encodedPayload}`,
    signature: signature,
  }
}

export function isSelfSigned(ucan: Ucan): boolean {
  return ucan.payload.iss === ucan.payload.aud
}

export async function isValid(agent: Agent.Implementation, ucan: Ucan): Promise<boolean> {
  const plugs = await plugins()
  const jwtAlg = await agent.ucanAlgorithm()

  const signature = Uint8arrays.fromString(ucan.signature, "base64url")
  const signedData = Uint8arrays.fromString(ucan.signedData, "utf8")

  return !Ucans.isExpired(ucan)
    && !Ucans.isTooEarly(ucan)
    && plugs.verifyIssuerAlg(ucan.payload.iss, jwtAlg)
    && plugs.verifySignature(ucan.payload.iss, signedData, signature)
}

export async function keyPair(agent: Agent.Implementation): Promise<Keypair> {
  const did = await AgentDID.signing(agent)

  return {
    did: () => did,
    jwtAlg: await agent.ucanAlgorithm(),
    sign: data => agent.sign(data),
  }
}

export async function plugins(): Promise<Ucans.Plugins> {
  return new Plugins([], {})
}

class Plugins extends Ucans.Plugins {
  verifyIssuerAlg(did: string, jwtAlg: string): boolean {
    const dk = DIDKey.fromString(did)
    return dk.alg === jwtAlg
  }

  async verifySignature(did: string, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
    const resolver = new Resolver(
      {
        ...ECDSA.verifier,
        ...EDDSA.verifier,
        ...RSA.verifier,
      },
      { cache: true }
    )

    const dk = DIDKey.fromString(did)

    return resolver.verify({
      alg: dk.alg,
      signature: sig,
      message: data,
      publicKey: dk.publicKey,
    })
  }
}
