import cbor from 'borc'
import { CID, FileContent } from '../ipfs'
import aes from 'keystore-idb/aes'
import file from './file'
import { splitPath } from './helpers'

type PrivateNode = {
  key: string // symmetric key
  links: Link[]
}

type Link = {
  name: string
  cid: CID // IPFS-compatible multihash (CIDv0/CIDv1)
  size?: number // the size of all children
}

type NonEmptyPath = string[]

export async function mkdir(root: CID, path: string, rootKey: string) {
  const parts = splitPath(path)
  if(parts.length === 0){
    return root
  }
  const toAdd = await emptyDir()
  return addChild(root, path, rootKey, toAdd)
}

export async function addChild(root: CID, path: string, rootKey: string, toAdd: PrivateNode, shouldOverwrite: boolean = true): Promise<CID> {
  const node = await resolve(root, rootKey)
  const updated = await addChildRecurse(node, splitPath(path), toAdd, name, shouldOverwrite)
  return putPrivate(updated, rootKey)
}

export async function addChildRecurse(node: PrivateNode, path: string[], child: PrivateNode, name: string, shouldOverwrite: boolean = true): Promise<PrivateNode> {
  let toAdd: PrivateNode
  if(path.length === 0) {
    if(findLink(node, name) !== null && !shouldOverwrite) {
      return node
    }
    toAdd = child
  } else {
    const nextLink = findLink(node, path[0])
    const nextNode = 
      nextLink === null 
      ? await emptyDir()
      : await resolve(nextLink.cid, node.key)
    toAdd = await addChildRecurse(nextNode, path.slice(1), child, name)
  }
  const cid = await putPrivate(toAdd, node.key)
  const link = { name, cid }
  const updatedNode = replaceLink(node, link)
  return updatedNode
}

export function replaceLink(node: PrivateNode, link: Link): PrivateNode {
  node = rmLink(node, link.name)
  node = addLink(node, link)
  return node
}

export function addLink(node: PrivateNode, link: Link): PrivateNode {
  node.links.push(link)
  return node
}

export function rmLink(node: PrivateNode, name: string): PrivateNode {
  node.links = node.links.filter(l => l.name !== name)
  return node
}

export async function emptyDir(): Promise<PrivateNode> {
  const key = await aes.makeKey()
  const keyStr = await aes.exportKey(key)
  return {
    key: keyStr,
    links: []
  }
}

export async function getFile(root: CID, path: string, rootKey: string): Promise<FileContent | null> {
  const fileNode = await get(root, path, rootKey)
  if(fileNode === null){
    return null
  }
  const contentLink = findLink(fileNode, 'index')
  if(contentLink === null){
    return null
  }
  const content = await file.catBuf(contentLink.cid)
  return decrypt(content, fileNode.key)
}

export async function listDirectory(root: CID, path: string, rootKey: string): Promise<Link[] | null> {
  const node = await get(root, path, rootKey)
  return node?.links || null
}

export async function get(root: CID, path: string, rootKey: string): Promise<PrivateNode | null> {
  const node = await resolve(root, rootKey)
  return getRecurse(node, splitPath(path))
}

export async function getRecurse(node: PrivateNode, path: string[]): Promise<PrivateNode | null> {
  if(path.length === 0){
    return node
  }
  const link = findLink(node, path[0])
  if(link === null){
    return null
  }
  const nextNode = await resolve(link.cid, node.key)
  return getRecurse(nextNode, path.slice(1))
}

export function findLink(node: PrivateNode, name: string): Link | null {
  return node.links?.find(l => l.name === name) || null
}

export async function putPrivate(node: PrivateNode, keyStr: string): Promise<CID> {
  const encrypted = encryptNode(node, keyStr)
  return file.add(encrypted)
}

export async function resolve(cid: CID, keyStr: string): Promise<PrivateNode> {
  const content = await file.catBuf(cid)
  return decryptNode(content, keyStr)
}

export async function encryptNode(node: PrivateNode, keyStr: string): Promise<Uint8Array> {
  const encoded = cbor.encode(node)
  return encrypt(encoded, keyStr)
}

export async function decryptNode(encrypted: Uint8Array, keyStr: string): Promise<PrivateNode> {
  const decrypted = await decrypt(encrypted, keyStr)
  return cbor.decode(decrypted)
}

export async function encrypt(data: Uint8Array, keyStr: string): Promise<Uint8Array> {
  const key = await aes.importKey(keyStr)
  const encrypted = await aes.encryptBytes(data.buffer, key)
  return new Uint8Array(encrypted)
}

export async function decrypt(encrypted: Uint8Array, keyStr: string): Promise<Uint8Array> {
  const key = await aes.importKey(keyStr)
  const decryptedBuf = await aes.decryptBytes(encrypted.buffer, key)
  return new Uint8Array(decryptedBuf)
}
