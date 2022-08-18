import * as uint8arrays from "uint8arrays"
import { CID } from "multiformats"
import { IPFS } from "ipfs-core-types"
import { initSync, PublicDirectory, PublicFile, PublicNode } from "wnfs"

import { WASM_WNFS_VERSION } from "../../common/version.js"
import { setup as setupInternal } from "../../setup/internal.js"
import { FileContent } from "../../ipfs/index.js"
import { Path } from "../../path.js"
import { AddResult } from "../../ipfs/index.js"
import { UnixTree, Puttable, File, Links, PuttableUnixTree } from "../types.js"
import { BlockStore, IpfsBlockStore } from "./IpfsBlockStore.js"
import { normalizeFileContent } from "../protocol/public/index.js"
import { BaseFile } from "../base/file.js"
import { Metadata } from "../metadata.js"

let initialized = false
async function initOnce() {
  if (!initialized) {
    initialized = true
    initSync(await setupInternal.wnfsWasmLookup(WASM_WNFS_VERSION))
  }
}

interface DirEntry {
  name: string
  metadata: {
    version: "3.0.0"
    unixMeta: {
      created: number
      modified: number
      mode: number
      kind: "raw" | "dir" | "file" | "metadata" | "symlink" | "hamtShard"
    }
  }
}

interface OpResult<A> {
  rootDir: PublicDirectory
  result: A
}

export class PublicRootWasm implements UnixTree, Puttable {

  root: Promise<PublicDirectory>
  lastRoot: PublicDirectory
  store: BlockStore
  ipfs: IPFS
  readOnly: boolean

  constructor(root: PublicDirectory, store: BlockStore, ipfs: IPFS, readOnly: boolean) {
    this.root = Promise.resolve(root)
    this.lastRoot = root
    this.store = store
    this.ipfs = ipfs
    this.readOnly = readOnly
  }

  static async empty(ipfs: IPFS): Promise<PublicRootWasm> {
    await initOnce()
    const store = new IpfsBlockStore(ipfs)
    const root = new PublicDirectory(new Date())
    return new PublicRootWasm(root, store, ipfs, false)
  }

  static async fromCID(ipfs: IPFS, cid: CID): Promise<PublicRootWasm> {
    await initOnce()
    const store = new IpfsBlockStore(ipfs)
    const root = await PublicDirectory.load(cid.bytes, store)
    return new PublicRootWasm(root, store, ipfs, false)
  }

  private async atomically(fn: (root: PublicDirectory) => Promise<PublicDirectory>) {
    const root = await this.root
    this.root = fn(root)
    await this.root
  }

  async ls(path: Path): Promise<Links> {
    const root = await this.root
    const { result: entries } = await root.ls(path, this.store) as OpResult<DirEntry[]>
    const result: Links = {}
    for (const entry of entries) {
      result[entry.name] = {
        name: entry.name,
        isFile: entry.metadata.unixMeta.kind === "file",
        size: 0, // TODO size?
        cid: "not provided for performance ", // TODO do we really need a CID here?
      }
    }
    return result
  }

  async mkdir(path: Path): Promise<this> {
    await this.atomically(async root => {
      const { rootDir } = await root.mkdir(path, new Date(), this.store) as OpResult<null>
      return rootDir
    })

    return this
  }

  async cat(path: Path): Promise<FileContent> {
    const { result: cidBytes } = await (await this.root).read(path, this.store) as OpResult<Uint8Array>
    const cid = CID.decode(cidBytes)

    const chunks = []
    for await (const chunk of this.ipfs.cat(cid, { preload: false })) {
      chunks.push(chunk)
    }
    return uint8arrays.concat(chunks)
  }

  async add(path: Path, content: FileContent): Promise<this> {
    const normalized = await normalizeFileContent(content)
    const { cid } = await this.ipfs.add(normalized, {
      cidVersion: 1,
      hashAlg: "sha2-256",
      rawLeaves: true,
      wrapWithDirectory: false,
      preload: false,
      pin: false,
    })

    await this.atomically(async root => {
      const { rootDir } = await root.write(path, cid.bytes, new Date(), this.store) as OpResult<null>
      return rootDir
    })

    return this
  }

  async rm(path: Path): Promise<this> {
    await this.atomically(async root => {
      const { rootDir } = await root.rm(path, this.store) as OpResult<null>
      return rootDir
    })

    return this
  }

  async mv(from: Path, to: Path): Promise<this> {
    await this.atomically(async root => {
      const { rootDir } = await root.basicMv(from, to, new Date(), this.store) as OpResult<null>
      return rootDir
    })

    return this
  }

  async get(path: Path): Promise<PuttableUnixTree | File | null> {
    const root = await this.root
    const { result: node } = await root.getNode(path, this.store) as OpResult<PublicNode>

    if (node == null) {
      return null
    }

    if (node.isFile()) {
      const cachedFile = node.asFile()
      const content = await this.cat(path)
      const directory = path.slice(0, -1)
      const filename = path[path.length - 1]

      return new PublicFileWasm(content, directory, filename, this, cachedFile)

    } else if (node.isDir()) {
      const cachedDir = node.asDir()

      return new PublicDirectoryWasm(this.readOnly, path, this, cachedDir)
    }

    throw new Error(`Unknown node type. Can only handle files and directories.`)
  }

  async exists(path: Path): Promise<boolean> {
    const root = await this.root
    const { result } = await root.getNode(path, this.store)
    return result != null
  }

  async historyStep(): Promise<PublicDirectory> {
    await this.atomically(async root => {
      const { rootDir: rebasedRoot } = await root.baseHistoryOn(this.lastRoot, this.store) as OpResult<null>
      this.lastRoot = root
      return rebasedRoot
    })
    return await this.root
  }

  async put(): Promise<CID> {
    const rebasedRoot = await this.historyStep()
    const cidBytes = await rebasedRoot.store(this.store) as Uint8Array
    return CID.decode(cidBytes)
  }

  async putDetailed(): Promise<AddResult> {
    return {
      cid: await this.put(),
      size: 0, // TODO figure out size
      isFile: false,
    }
  }

}

export class PublicDirectoryWasm implements UnixTree, Puttable {
  readOnly: boolean

  private directory: string[]
  private publicRoot: PublicRootWasm
  private cachedDir: PublicDirectory

  constructor(readOnly: boolean, directory: string[], publicRoot: PublicRootWasm, cachedDir: PublicDirectory) {
    this.readOnly = readOnly
    this.directory = directory
    this.publicRoot = publicRoot
    this.cachedDir = cachedDir
  }

  private checkMutability(operation: string) {
    if (this.readOnly) throw new Error(`Directory is read-only. Cannot ${operation}`)
  }

  private async updateCache() {
    const root = await this.publicRoot.root
    const node = await root.getNode(this.directory, this.publicRoot.store)
    this.cachedDir = node.asDir()
  }

  get header(): { metadata: Metadata; previous?: CID } {
    return nodeHeader(this.cachedDir)
  }

  async ls(path: Path): Promise<Links> {
    return await this.publicRoot.ls([...this.directory, ...path])
  }

  async mkdir(path: Path): Promise<this> {
    this.checkMutability(`mkdir at ${[...this.directory, ...path].join("/")}`)
    await this.publicRoot.mkdir([...this.directory, ...path])
    await this.updateCache()
    return this
  }

  async cat(path: Path): Promise<FileContent> {
    return await this.publicRoot.cat([...this.directory, ...path])
  }

  async add(path: Path, content: FileContent): Promise<this> {
    this.checkMutability(`write at ${[...this.directory, ...path].join("/")}`)
    await this.publicRoot.add([...this.directory, ...path], content)
    await this.updateCache()
    return this
  }

  async rm(path: Path): Promise<this> {
    this.checkMutability(`remove at ${[...this.directory, ...path].join("/")}`)
    await this.publicRoot.rm([...this.directory, ...path])
    await this.updateCache()
    return this
  }

  async mv(from: Path, to: Path): Promise<this> {
    this.checkMutability(`mv from ${[...this.directory, ...from].join("/")} to ${[...this.directory, ...to].join("/")}`)
    await this.publicRoot.mv([...this.directory, ...from], [...this.directory, ...to])
    await this.updateCache()
    return this
  }

  async get(path: Path): Promise<PuttableUnixTree | File | null> {
    return await this.publicRoot.get([...this.directory, ...path])
  }

  async exists(path: Path): Promise<boolean> {
    return await this.publicRoot.exists([...this.directory, ...path])
  }

  async put(): Promise<CID> {
    await this.publicRoot.put()
    const root = await this.publicRoot.root
    const cidBytes: Uint8Array = await root.store(this.publicRoot.store)
    return CID.decode(cidBytes)
  }

  async putDetailed(): Promise<AddResult> {
    return {
      isFile: false,
      size: 0,
      cid: await this.put()
    }
  }

}

// This is somewhat of a weird hack of providing a result for a `get()` operation.
export class PublicFileWasm extends BaseFile {
  private directory: string[]
  private filename: string
  private publicRoot: PublicRootWasm
  private cachedFile: PublicFile

  constructor(content: FileContent, directory: string[], filename: string, publicRoot: PublicRootWasm, cachedFile: PublicFile) {
    super(content)
    this.directory = directory
    this.filename = filename
    this.publicRoot = publicRoot
    this.cachedFile = cachedFile
  }

  private async updateCache() {
    const root = await this.publicRoot.root
    const node = await root.getNode([...this.directory, this.filename], this.publicRoot.store)
    this.cachedFile = node.asFile()
  }

  get header(): { metadata: Metadata; previous?: CID } {
    return nodeHeader(this.cachedFile)
  }

  async updateContent(content: FileContent): Promise<this> {
    await super.updateContent(content)
    await this.updateCache()
    return this
  }

  async putDetailed(): Promise<AddResult> {
    const root = await this.publicRoot.root
    const path = [...this.directory, this.filename]
    const { result: node } = await root.getNode(path, this.publicRoot.store) as OpResult<PublicNode>

    if (node == null) {
      throw new Error(`No file at /${path.join("/")}.`)
    }

    if (!node.isFile()) {
      throw new Error(`Not a file at /${path.join("/")}`)
    }

    const file = node.asFile()

    return {
      isFile: true,
      size: 0,
      cid: CID.decode(await file.store(this.publicRoot.store))
    }
  }

}

function nodeHeader(node: PublicFile | PublicDirectory): { metadata: Metadata; previous?: CID } {
  // There's some differences between the two.
  const meta = node.metadata()
  const metadata: Metadata = {
    isFile: meta.unixMeta.kind === "file",
    version: meta.version,
    unixMeta: {
      _type: meta.unixMeta.kind,
      ctime: Number(meta.unixMeta.created),
      mtime: Number(meta.unixMeta.modified),
      mode: meta.unixMeta.mode,
    }
  }

  const previous = node.previousCid()
  return previous == null ? { metadata } : {
    metadata,
    previous: CID.decode(previous),
  }
}
