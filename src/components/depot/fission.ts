import { Implementation } from "./implementation.js"

import * as Fission from "../../common/fission.js"
import { Manners, Storage } from "../../components.js"
import { FileSystem } from "../../fs/class.js"
import * as IPFS from "./ipfs-bitswap-websockets.js"

// 🛳

export async function implementation(
  manners: Manners.Implementation<FileSystem>,
  storage: Storage.Implementation,
  blockstoreName: string,
  optionalEndpoints?: Fission.Endpoints
): Promise<Implementation> {
  const endpoints = optionalEndpoints || Fission.PRODUCTION

  return IPFS.implementation({
    blockstoreName,
    manners,
    storage,
    gatewayUrl: endpoints.ipfsGateway,
    peersUrl: endpoints.server + "/ipfs/peers",
  })
}
