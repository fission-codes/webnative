import localforage from "localforage"

import { Implementation, ImplementationOptions } from "../implementation.js"
import { assertBrowser } from "../../../common/browser.js"


export function getItem<T>(db: LocalForage, key: string): Promise<T | null> {
  assertBrowser("storage.getItem")
  return db.getItem(key)
}

export function setItem<T>(db: LocalForage, key: string, val: T): Promise<T> {
  assertBrowser("storage.setItem")
  return db.setItem(key, val)
}

export function removeItem(db: LocalForage, key: string): Promise<void> {
  assertBrowser("storage.removeItem")
  return db.removeItem(key)
}

export async function clear(db: LocalForage): Promise<void> {
  assertBrowser("storage.clear")
  return db.clear()
}



// 🛳


export function implementation({ name }: ImplementationOptions): Implementation {
  const db = localforage.createInstance({ name })
  const withDb = (func: Function) => (...args: unknown[]) => func(db, ...args)

  return {
    KEYS: {
      ACCOUNT_UCAN: "account-ucan",
      CID_LOG: "cid-log",
      SESSION: "session",
      UCANS: "permissioned-ucans",
    },

    getItem: withDb(getItem),
    setItem: withDb(setItem),
    removeItem: withDb(removeItem),
    clear: withDb(clear),
  }
}
