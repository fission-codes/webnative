import { CID } from "./common/cid.js"
import { EventEmitter } from "./common/event-emitter.js"
import { DistinctivePath, Partition, Partitioned } from "./path/index.js"
import { Ucan } from "./ucan/types.js"

export { EventEmitter, EventEmitter as Emitter }

/**
 * Events interface.
 *
 * Subscribe to events using `on` and unsubscribe using `off`,
 * alternatively you can use `addListener` and `removeListener`.
 *
 * ```ts
 * program.on("fileSystem:local-change", ({ path, root }) => {
 *   console.log("The file system has changed locally 🔔")
 *   console.log("Changed path:", path)
 *   console.log("New data root CID:", root)
 * })
 *
 * program.off("fileSystem:publish")
 * ```
 */
export type ListenTo<EventMap> = Pick<
  EventEmitter<EventMap>,
  "addListener" | "removeListener" | "on" | "off"
>

export type FileSystem = {
  "local-change": { dataRoot: CID; path: DistinctivePath<Partitioned<Partition>> }
  "publish": { dataRoot: CID; proofs: Ucan[] }
}

export type AuthorityRequestor = {
  "challenge": any // TODO
}

export type AuthorityProvider = {
  "approved": void
  "challenge": any // TODO
  "dismissed": void
  "query": Record<string, any> // TODO
}

export type Repositories<Collection> = {
  "collection:changed": { collection: Collection }
}

export type All = FileSystem

export function createEmitter<EventMap>(): EventEmitter<EventMap> {
  return new EventEmitter()
}

export function listenTo<EventMap>(emitter: EventEmitter<EventMap>): ListenTo<EventMap> {
  return {
    addListener: emitter.addListener.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
  }
}

export function merge<A, B>(a: EventEmitter<A>, b: EventEmitter<B>): EventEmitter<A & B> {
  const merged = createEmitter<A & B>()
  const aEmit = a.emit
  const bEmit = b.emit

  a.emit = <K extends keyof A>(eventName: K, event: (A & B)[K]) => {
    aEmit.call(a, eventName, event)
    merged.emit(eventName, event)
  }

  b.emit = <K extends keyof B>(eventName: K, event: (A & B)[K]) => {
    bEmit.call(b, eventName, event)
    merged.emit(eventName, event)
  }

  return merged
}
