import { CID } from "multiformats/cid"

import * as Identifiers from "../../src/common/identifiers.js"
import * as Path from "../../src/path/index.js"
import FileSystem from "../../src/fs/filesystem.js"
import { account, components, configuration, crypto } from "./components.js"


export const emptyFilesystem: () => Promise<FileSystem> = async () => {
  return FileSystem.empty({
    account,
    appInfo: configuration.appInfo,
    dependents: components,
    localOnly: true,
    permissions: {
      fs: {
        public: [ Path.root() ],
        private: [ Path.root() ]
      }
    },
  })
}


export async function loadFilesystem(cid: CID, readKey?: Uint8Array): Promise<FileSystem> {
  if (readKey != null) {
    await crypto.keystore.importSymmKey(
      readKey,
      await Identifiers.readKey({
        accountDID: account.rootDID,
        crypto,
        path: Path.directory(Path.Branch.Private)
      })
    )
  }

  const fs = await FileSystem.fromCID(cid, {
    account,
    appInfo: configuration.appInfo,
    dependents: components,
    localOnly: true,
    permissions: {
      fs: {
        public: [ Path.root() ],
        private: [ Path.root() ]
      }
    }
  })

  if (fs == null) {
    throw new Error(`Couldn't load filesystem from CID ${cid} (and readKey ${readKey})`)
  }

  return fs
}
