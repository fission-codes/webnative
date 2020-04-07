import { CID, FileContent } from '../../../ipfs'
import { Links, Metadata } from '../../types'
import util from './util'

export const getFile = async (cid: CID): Promise<FileContent> => {
  return util.getFile(cid)
}

export const getLinks = async (cid: CID): Promise<Links> => {
  return util.getLinks(cid)
}

export const getMetadata = async (_cid: CID): Promise<Partial<Metadata>> => {
  return { }
}

export const putFile = async (content: FileContent, _metadata: Partial<Metadata>): Promise<CID> => {
  return util.putFile(content)
}

export const putTree = async (links: Links, _metadata: Partial<Metadata>): Promise<CID> => { 
  return util.putLinks(Object.values(links))
}

export default {
  getFile,
  getLinks,
  getMetadata,
  putFile,
  putTree
}
