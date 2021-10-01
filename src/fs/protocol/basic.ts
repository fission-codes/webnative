/** @internal */
import type { ImportCandidate } from "ipfs-core-types/src/utils"

import { SymmAlg } from "keystore-idb/lib/types.js"

import * as ipfs from "../../ipfs/index.js"
import { CID, FileContent, AddResult } from "../../ipfs/index.js"

import { SimpleLinks, Links } from "../types.js"
import * as link from "../link.js"


export const getFile = async (cid: CID): Promise<Uint8Array> => {
  return ipfs.catBuf(cid)
}

export const getEncryptedFile = async (cid: CID, key: string, alg: SymmAlg): Promise<FileContent> => {
  return ipfs.encoded.catAndDecode(cid, key, alg) as Promise<FileContent>
}

export const putFile = async (content: ImportCandidate): Promise<AddResult> => {
  return ipfs.add(content)
}

export const putEncryptedFile = async (content: FileContent, key: string, alg: SymmAlg): Promise<AddResult> => {
  return ipfs.encoded.add(content, key, alg)
}

export const getSimpleLinks = async (cid: CID): Promise<SimpleLinks> => {
  const dagNode = await ipfs.dagGet(cid)
  return link.arrToMap(
    dagNode.Links.map(link.fromDAGLink)
  )
}

export const getLinks = async (cid: CID): Promise<Links> => {
  const raw = await ipfs.ls(cid)
  const links = link.arrToMap(
    raw.map(link.fromFSFile)
  )
  // ipfs.ls does not return size, so we need to interpolate that in ourselves
  // @@TODO: split into two functions: getLinks & getLinksDetailed. mtime & isFile are stored in our FS format in all but the pretty tree
  const dagNode = await ipfs.dagGet(cid)
  dagNode.Links.forEach((l) => {
    if(links[l.Name] && links[l.Name].size === 0){
      links[l.Name].size = l.Tsize
    }
  })
  return links
}

export const putLinks = async (links: Links | SimpleLinks): Promise<AddResult> => {
  const dagLinks = Object.values(links)
    .filter(l => l !== undefined)
    .map(link.toDAGLink)
  return ipfs.dagPutLinks(dagLinks)
}
