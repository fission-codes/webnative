import getIpfsWithCfg from 'get-ipfs'
import { IPFS } from './types'

const PEER_WSS = "/dns4/node.fission.systems/tcp/4003/wss/ipfs/QmVLEz2SxoNiFnuyLpbXsH6SvjPTrHNMU88vCQZyhgBzgw"
const IPFS_CFG = {
  browserPeers: [ PEER_WSS ],
  jsIpfs: "https://unpkg.com/ipfs@0.48.0/dist/index.min.js"
}

let ipfs: IPFS | null = null

// TODO: There is funky type stuff going on here with `any`s
// This is because we need to redo the types for js-ipfs.
// get-ipfs is still on old types, and this pkg is progressively creating the new types

export const setIpfs = (userIpfs: unknown): void => {
  ipfs = userIpfs as IPFS
}

export const getIpfs = async (options = {}): Promise<IPFS> => {
  if (ipfs) return ipfs
  ipfs = (await getIpfsWithCfg({ ...IPFS_CFG, ...options })) as unknown as IPFS
  return ipfs
}

export default {
  setIpfs,
  getIpfs,
}
