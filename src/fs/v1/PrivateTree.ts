import { AddResult, CID, FileContent } from '../../ipfs'
import MMPT from '../protocol/private/mmpt'
import PrivateFile from './PrivateFile'
import { DecryptedNode, PrivateName, BareNameFilter, PrivateSkeletonInfo, PrivateTreeInfo, AESKey, PrivateChildren, Revision, PrivateFileInfo, PrivateSkeleton, PrivateAddResult } from '../protocol/private/types'
import * as keystore from '../../keystore'
import * as protocol from '../protocol'
import * as check from '../protocol/private/types/check'
import * as pathUtil from '../path'
import * as metadata from '../metadata'
import * as semver from '../semver'
import * as namefilter from '../protocol/private/namefilter'
import { isObject, mapObj, Maybe, removeKeyFromObj } from '../../common'
import { File, Links, Metadata, NonEmptyPath, PutDetails, SyncHookDetailed, Tree, UnixTree } from '../types'
import BaseTree from '../base/tree'
import { genKeyStr } from '../../keystore'

type CreateChildFn = (parent: PrivateTreeInfo, name: string, key: string) => DecryptedNode | Promise<DecryptedNode>

type ConstructorParams = {
  mmpt: MMPT
  key: AESKey
  info: PrivateTreeInfo
}

export default class PrivateTree extends BaseTree implements Tree, UnixTree {

  mmpt: MMPT
  key: AESKey
  info: PrivateTreeInfo

  onUpdate: Maybe<SyncHookDetailed> = null

  constructor({ mmpt, key, info}: ConstructorParams) {
    super(semver.v1)
    this.mmpt = mmpt
    this.key = key
    this.info = info
  }

  // @@TODO: make this more robust
  static instanceOf(obj: any): obj is PrivateTree {
    return isObject(obj) 
      && obj.mmpt !== undefined 
      && check.isPrivateTreeInfo(obj.info)
  }

  static async create(mmpt: MMPT, key: AESKey, parentNameFilter: Maybe<BareNameFilter>): Promise<PrivateTree> {
    const bareNameFilter = parentNameFilter 
      ? await namefilter.addToBare(parentNameFilter, key)
      : await namefilter.createBare(key)
    return new PrivateTree({
      mmpt,
      key,
      info: {
        metadata: metadata.empty(),
        bareNameFilter,
        revision: 1,
        children: {},
        skeleton: {},
      }
    })
  }

  static async fromCID(mmpt: MMPT, cid: CID, key: string): Promise<PrivateTree> {
    const info = await protocol.priv.getByCID(mmpt, cid, key)
    if(!check.isPrivateTreeInfo(info)) {
      throw new Error(`Could not parse a valid private tree at: ${cid}`)
    }
    return new PrivateTree({ mmpt, info, key })
  }

  static async fromBaseKey(mmpt: MMPT, key: string): Promise<PrivateTree> {
    const bareNameFilter = await namefilter.createBare(key)
    const revisionFilter = await namefilter.addRevision(bareNameFilter, key, 1)
    const name = await namefilter.toPrivateName(revisionFilter)
    const info = await protocol.priv.getByName(mmpt, name, key)
    if(!check.isPrivateTreeInfo(info)) {
      throw new Error(`Could not parse a valid private tree using the given key`)
    }
    return new PrivateTree({ mmpt, info, key })
  }

  static async fromInfo(mmpt: MMPT, key: AESKey, info: PrivateTreeInfo): Promise<PrivateTree> {
    return new PrivateTree({ mmpt, key, info })
  }

  async emptyChildTree(): Promise<PrivateTree> {
    const key = await genKeyStr()
    return PrivateTree.create(this.mmpt, key, this.info.bareNameFilter)
  }

  async createChildFile(content: FileContent): Promise<PrivateFile>{
    const key = await genKeyStr()
    return PrivateFile.create(this.mmpt, content, this.info.bareNameFilter, key)
  }


  async putDetailed(): Promise<PrivateAddResult> {
    const result = await protocol.priv.addNode(this.mmpt, {
      ...this.info, 
      metadata: {
        ...this.info.metadata,
        mtime: Date.now()
      }
    }, this.key)
    if(this.onUpdate !== null){
      const syncResult = await this.mmpt.put()
      this.onUpdate(syncResult)
    }
    return result
  }

  async updateDirectChild (child: PrivateTree | PrivateFile, name: string): Promise<this> {
    await child.updateParentNameFilter(this.info.bareNameFilter)
    const { cid, size, key } = await child.putDetailed()
    this.info.children[name] = { name, key, cid, size, isFile: PrivateFile.instanceOf(child) }
    this.info.skeleton[name] = { cid, key, children: PrivateTree.instanceOf(child) ? child.info.skeleton : {} }
    this.info.revision = this.info.revision + 1
    return this
  }

  async getDirectChild(name: string): Promise<PrivateTree | PrivateFile | null>{
    const child = this.info.children[name]
    if(child === undefined) return null
    return child.isFile
      ? PrivateFile.fromCID(this.mmpt, child.cid, child.key)
      : PrivateTree.fromCID(this.mmpt, child.cid, child.key)
  }

  async getOrCreateDirectChild(name: string): Promise<PrivateTree | PrivateFile> {
    const child = await this.getDirectChild(name)
    return child ? child : this.emptyChildTree()
  }




  getLinks(): Links {
    return mapObj(this.info.children, (link) => {
      const { key, ...rest } = link
      return { ...rest }
    })
  }

  async removeDirectChild(name: string): Promise<this> {
    this.info = {
      ...this.info,
      revision: this.info.revision + 1,
      children: removeKeyFromObj(this.info.children, name),
      skeleton: removeKeyFromObj(this.info.skeleton, name)
    }
    return this
  }

  async updateParentNameFilter(parentNameFilter: BareNameFilter): Promise<this> {
    this.info.bareNameFilter = await namefilter.addToBare(parentNameFilter, this.key)
    return this
  }




  async get(path: string): Promise<PrivateTree | PrivateFile | null> {
    const parts = pathUtil.splitParts(path)
    if(parts.length === 0) return this

    const [head, ...rest] = parts

    const next = this.info.skeleton[head]
    if(next === undefined) return null

    const node = await this.getRecurse(next, rest)
    if(node === null) return null
      
    return check.isPrivateFileInfo(node)
      ? PrivateFile.fromInfo(this.mmpt, node)
      : PrivateTree.fromInfo(this.mmpt, next.key, node)
  }

  async getRecurse(nodeInfo: PrivateSkeletonInfo, parts: string[]): Promise<Maybe<DecryptedNode>> {
    const [head, ...rest] = parts
    if(head === undefined) {
      return protocol.priv.getByCID(this.mmpt, nodeInfo.cid, nodeInfo.key)
    }
    const nextChild = nodeInfo.children[head]
    if(nextChild !== undefined) {
      return this.getRecurse(nextChild, rest)
    }

    const reloadedNode = await protocol.priv.getByCID(this.mmpt, nodeInfo.cid, nodeInfo.key)
    if(!check.isPrivateTreeInfo(reloadedNode)){
      return null
    }
    const reloadedNext = reloadedNode.skeleton[head]
    return reloadedNext === undefined ? null : this.getRecurse(reloadedNext, rest)
  }
}
