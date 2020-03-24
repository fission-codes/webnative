import { FileContent, CID } from '../ipfs'

export type AddLinkOpts = {
  shouldOverwrite?: boolean
}

export type NonEmptyPath = [string, ...string[]]

export type PrivateNodeData = {
  key: string
  links: Link[]
}

export type Link = {
  name: string
  cid: CID
  size?: number 
}

export interface Node {
  updateChild(child: Node, name: string): Promise<Node>
  resolveChild(name: string): Promise<Node | null>
  resolveOrAddChild(name: string): Promise<Node>
  findLink(name: string): Link | null
  addLink(link: Link): Node
  rmLink(name: string): Node
  replaceLink(link: Link): Node
}

export interface Tree {
  put(): Promise<CID>
  cid(): Promise<CID>
  listDir(path: string): Promise<Link[] | null>
  makeDir(path: string): Promise<Tree>
  addFile(path: string, content: FileContent): Promise<Tree>
  get(path: string): Promise<Node | null>
  addChild(path: string, toAdd: Node, shouldOverwrite: boolean): Promise<Tree>
}
  