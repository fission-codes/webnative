import pubTree, { PublicTree } from './pub/tree'
import privTree, { PrivateTree } from './priv/tree'
import pubNode, { PublicNode } from './pub/node'
import { Tree, Node, Link } from './types'
import { CID, FileContent } from '../ipfs'

export class FFS {

  root: PublicNode
  pubTree: PublicTree
  privTree: PrivateTree

  constructor(root: PublicNode, pubTree: PublicTree, privTree: PrivateTree) {
    this.root = root
    this.pubTree = pubTree
    this.privTree = privTree
  }

  async put(): Promise<CID> {
    return this.root.put()
  }

  async cid(): Promise<CID> {
    return this.put()
  }

  async listDir(path: string, isPublic: boolean = false): Promise<Link[] | null> {
    const tree = this.whichTree(isPublic)
    return tree.listDir(path)
  }

  async makeDir(path: string, isPublic: boolean = false): Promise<FFS> {
    const tree = this.whichTree(isPublic)
    await tree.makeDir(path)
    return this.updateRoot()
  }

  async addFile(path: string, content: FileContent, isPublic: boolean = false): Promise<FFS> {
    const tree = this.whichTree(isPublic)
    await tree.addFile(path, content)
    return this.updateRoot()
  }

  async getFile(path: string, fromPublic: boolean = false): Promise<FileContent | null> {
    const tree = this.whichTree(fromPublic)
    return tree.getFile(path)
  }

  async getNode(path: string, fromPublic: boolean = false): Promise<Node | null> {
    const tree = this.whichTree(fromPublic)
    return tree.getNode(path)
  }

  async updateRoot(): Promise<FFS> {
    const pubCID = await this.pubTree.put()
    const privCID = await this.privTree.put()
    const pubLink = { name: 'public', cid: pubCID }
    const privLink = { name: 'private', cid: privCID }
    this.root.replaceLink(pubLink)
    this.root.replaceLink(privLink)
    return this
  }

  whichTree(isPublic: boolean): Tree {
    return isPublic ? this.pubTree : this.privTree
  }
}

export async function empty(): Promise<FFS> {
  const root = await pubNode.empty()
  const pubTreeInstance = await pubTree.empty()
  const privTreeInstance = await privTree.empty()
  return new FFS(root, pubTreeInstance, privTreeInstance)
}

export async function resolve(cid: CID, keyStr: string): Promise<FFS | null> {
  const root = await pubNode.resolve(cid)
  const pubLink = root.findLink('public')
  const privLink = root.findLink('private')
  if(pubLink === null || privLink === null) {
    return null
  }
  const pubTreeInstance = await pubTree.resolve(pubLink.cid)
  const privTreeInstance = await privTree.resolve(privLink.cid, keyStr)
  return new FFS(root, pubTreeInstance, privTreeInstance)
}

export default {
  FFS,
  empty,
  resolve
}
