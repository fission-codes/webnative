import { CID, FileContent } from '../../ipfs'

import { Tree, File, Metadata, Header, SemVer, TreeData, PrivateTreeData, CacheMap } from '../types'
import check from '../types/check'
import { Maybe } from '../../common'

// Normalization

import { getVersion } from './header'
import basic from './versions/v0_0_0'
import nested from './versions/v1_0_0'

export const getDirectChild = async (tree: Tree, name: string): Promise<Tree | File | null>  => {
  const version = tree.getHeader().version
  const fns = switchVersion(version)
  return fns.getDirectChild(tree, name)
}

export const getFile = async (cid: CID, key: Maybe<string>): Promise<FileContent> => {
  const fns = await getAndSwitchVersion(cid, key)
  return fns.getFile(cid, key)
}

export const getTreeData = async (cid: CID, key: Maybe<string>): Promise<TreeData> => {
  const fns = await getAndSwitchVersion(cid, key)
  return fns.getTreeData(cid, key)
}

export const getPrivateTreeData = async (cid: CID, key: string): Promise<PrivateTreeData> => {
  const data = await getTreeData(cid, key)
  if (!check.isPrivateTreeData(data)) {
    throw new Error(`Not a valid private tree node: ${cid}`)
  }
  return data
}

export const getMetadata = async (cid: CID, key: Maybe<string>): Promise<Metadata> => {
  const fns = await getAndSwitchVersion(cid, key)
  return fns.getMetadata(cid, key)
}

export const getCacheMap = async (cid: CID, key: Maybe<string>): Promise<CacheMap> => {
  const fns = await getAndSwitchVersion(cid, key)
  return fns.getCache(cid, key)
}

export const getHeader = async(cid: CID, key: Maybe<string>): Promise<Header> => {
  const version = await getVersion(cid, key)
  const { name, isFile, mtime, size } = await getMetadata(cid, key)
  const cache = await getCacheMap(cid, key)
  const data = await getTreeData(cid, key)
  const childKey = check.isPrivateTreeData(data) ? data.key : null
  return {
    name,
    version,
    key: childKey,
    cache,
    isFile,
    mtime,
    size
  }
}

export const putFile = async (
  version: SemVer,
  content: FileContent,
  header: Partial<Header>,
  key: Maybe<string>
): Promise<CID> => {
  const fns = switchVersion(version)
  return fns.putFile(content, header, key)
}

export const putTree = async (
  header: Header,
  key: Maybe<string>,
): Promise<CID> => {
  const fns = switchVersion(header.version)
  return fns.putTree(header, key)
}

const getAndSwitchVersion = async (cid: CID, key: Maybe<string>) => {
  const version = await getVersion(cid, key)
  return switchVersion(version)
}

const switchVersion = (version: SemVer) => {
  switch (version.major) {
    case 0:   return basic
    case 1:   return nested
    default:  return basic
  }
}

export default {
  getDirectChild,
  getFile,
  getTreeData,
  getPrivateTreeData,
  getMetadata,
  getVersion,
  getCacheMap,
  getHeader,
  putFile,
  putTree
}
