import dagPB from 'ipld-dag-pb'
import ipfs, { CID, DAGLink, UnixFSFile } from '../ipfs'
import { NonEmptyPath, Tree, Link, Links, FullLink, FullLinks } from './types'

export const toDAGLink = (link: Link): DAGLink => {
  const { name, cid, size } = link
  return new dagPB.DAGLink(name, size, cid)
}

export const fromFSFile = (fsObj: UnixFSFile): Link => {
  const { name = '', cid, size, mtime } = fsObj
  return {
    name,
    cid: cid.toString(),
    size,
    mtime
  }
}

export const make = (name: string, cid: string, size?: number): Link => {
  return {
    name,
    cid,
    size,
    mtime: Date.now()
  }
}

export const upgradeLink = async (tree: Tree, link: Link): Promise<FullLink> => {
  const child = await tree.getDirectChild(link.name)
  return {
    ...link,
    isFile: child?.isFile() || false
  }
}

export const upgradeLinks = async (tree: Tree): Promise<FullLinks> => {
  const upgraded = await Promise.all(
    Object.values(tree.links).map((l: Link) => upgradeLink(tree, l))
  )
  return upgraded.reduce((acc, cur) => {
    acc[cur.name] = cur
    return acc
  }, {} as FullLinks)
}



export default {
  toDAGLink,
  fromFSFile,
  make,
  upgradeLink,
  upgradeLinks,
}
