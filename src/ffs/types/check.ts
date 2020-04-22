import { isString, isObject } from '../../common'
import { Link, Links, TreeData, PrivateTreeData, PinMap } from '../types'
import { CID } from '../../ipfs'

export const isLink = (link: any): link is Link => {
  return typeof link?.name === 'string' && typeof link?.cid === 'string'
}

export const isLinks = (obj: any): obj is Links => {
  return typeof obj === 'object' && Object.values(obj).every(isLink)
}

export const isTreeData = (obj: any): obj is TreeData => {
  return isLinks(obj?.links)
}

export const isPrivateTreeData = (data: any): data is PrivateTreeData => {
  return data?.key !== undefined
}

export const isCIDList = (obj: any): obj is CID[] => {
  return Array.isArray(obj) && obj.every(isString)
}

export const isPinMap = (obj: any): obj is PinMap => {
  return isObject(obj) && Object.values(obj).every(isCIDList)
}

export default {
  isLink,
  isLinks,
  isTreeData,
  isPrivateTreeData,
  isCIDList,
  isPinMap
}
