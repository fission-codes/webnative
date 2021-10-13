import { CID as CIDObj } from "multiformats/cid"
import dagPb, { DAGLink, DAGNode } from "ipld-dag-pb"
import * as dagPB from "@ipld/dag-pb"
import type { IPFSEntry } from "ipfs-core-types/src/root"
import type { ImportCandidate } from "ipfs-core-types/src/utils"

import { get as getIpfs } from "./config.js"
import { CID, AddResult } from "./types.js"
import * as util from "./util.js"
import { DAG_NODE_DATA } from "./constants.js"
import * as uint8arrays from "uint8arrays"
import { setup } from "../setup/internal.js"
import { isObject, isString } from "../common/type-checks.js"


export const add = async (content: ImportCandidate): Promise<AddResult> => {
  const ipfs = await getIpfs()
  const result = await ipfs.add(content, { cidVersion: 1, pin: setup.shouldPin })

  return {
    cid: result.cid.toString(),
    size: result.size,
    isFile: true
  }
}

export const catRaw = async (cid: CID): Promise<Uint8Array[]> => {
  const ipfs = await getIpfs()
  const chunks = []
  await attemptPin(cid)
  for await (const chunk of ipfs.cat(CIDObj.parse(cid))) {
    chunks.push(chunk)
  }
  return chunks
}

export const catBuf = async (cid: CID): Promise<Uint8Array> => {
  const raw = await catRaw(cid)
  return uint8arrays.concat(raw)
}

export const cat = async (cid: CID): Promise<string> => {
  const buf = await catBuf(cid)
  return buf.toString()
}

export const ls = async (cid: CID): Promise<IPFSEntry[]> => {
  const ipfs = await getIpfs()
  const links = []
  for await (const link of ipfs.ls(CIDObj.parse(cid))) {
    links.push(link)
  }
  return links
}

export const dagGet = async (cid: CID): Promise<DAGNode> => {
  const ipfs = await getIpfs()
  await attemptPin(cid)
  const raw = await ipfs.dag.get(CIDObj.parse(cid))
  const node = util.rawToDAGNode(raw)
  return node
}

export const dagPut = async (node: DAGNode): Promise<AddResult> => {
  const ipfs = await getIpfs()
  const newNode = dagPB.createNode(
    node.Data,
    node.Links.map(link => dagPB.createLink(
      link.Name,
      link.Tsize,
      CIDObj.decode(link.Hash.bytes)
    ))
  )
  // using this format because Gateway doesn't like `dag-cbor` nodes.
  // I think this is because UnixFS requires `dag-pb` & the gateway requires UnixFS for directory traversal
  const cidObj = await ipfs.dag.put(newNode, { format: "dag-pb", hashAlg: "sha2-256" })
  const cid = cidObj.toV1().toString()
  await attemptPin(cid)
  const nodeSize = await size(cid)
  return {
    cid,
    size: nodeSize,
    isFile: false
  }
}

export const dagPutLinks = async (links: DAGLink[]): Promise<AddResult> => {
  const node = new dagPb.DAGNode(DAG_NODE_DATA, links)
  return dagPut(node)
}

export const size = async (cid: CID): Promise<number> => {
  const ipfs = await getIpfs()
  const stat = await ipfs.files.stat(`/ipfs/${cid}`)
  return stat.cumulativeSize
}

export const attemptPin = async (cid: CID): Promise<void> => {
  if (!setup.shouldPin) return

  const ipfs = await getIpfs()
  try {
    await ipfs.pin.add(cid, { recursive: false })
  } catch (err) {
    if (!isObject(err) || !isString(err.message)) {
      throw new Error("couldn't pin")
    }
    if (!err.message || !err.message.includes("already pinned recursively")) {
      throw err
    }
  }
}
