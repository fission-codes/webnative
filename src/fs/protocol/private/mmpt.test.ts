import crypto from "crypto"
import Ipfs, { IPFS } from "ipfs"

import MMPT from "./mmpt"
import * as ipfsConfig from "../../../ipfs/config"

function sha256Str(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}

function encode(str: string): Uint8Array {
  return (new TextEncoder()).encode(str)
}

let ipfs: IPFS;

/*
Generates lots of entries for insertion into the MMPT.

The MMPT is a glorified key-value store.

This returns an array of key-values sorted by the key,
so that key collisions are more likely to be tested.
*/
async function generateExampleEntries(amount: number): Promise<{ name: string, cid: string }[]> {
  let entries: { name: string, cid: string }[] = []

  for (const i of Array(amount).keys()) {
    const hash = sha256Str(`${i}`)
    const cid = await ipfs.object.put({ Data: encode(hash), Links: [] })
    entries.push({
      name: hash,
      cid: cid.toBaseEncodedString(),
    })
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name))
}



beforeAll(async done => {
  ipfs = await Ipfs.create({ offline: true, silent: true })
  ipfsConfig.set(ipfs)
  done()
})

afterAll(async done => {
  ipfs.stop()
  done()
})

describe("the mmpt", () => {
  it("can handle concurrent adds", async () => {
    const mmpt = MMPT.create()

    // Generate lots of entries
    const amount = 1000
    const entries = await generateExampleEntries(amount)

    // Concurrently add all those entries to the MMPT
    await Promise.all(entries.map(entry => mmpt.add(entry.name, entry.cid)))

    // Check that the MMPT contains all entries we added
    const members = await mmpt.members()
    const hashes = members.map(member => member.cid).sort()
    const inputHashes = entries.map(entry => entry.cid).sort()

    expect(hashes).toStrictEqual(inputHashes)
  })

  // This test used to generate even more data races
  it("can handle concurrent adds in batches", async () => {
    const mmpt = MMPT.create()

    // Generate lots of entries
    const amount = 500
    const entries = await generateExampleEntries(amount)

    const slice_size = 5
    let soFar = []
    let missing = []

    for (let i = 0; i < entries.length; i += slice_size) {
      const slice = entries.slice(i, i + slice_size)
      await Promise.all(slice.map(entry => mmpt.add(entry.name, entry.cid)))
      soFar = soFar.concat(slice)
      const members = await mmpt.members()

      missing = soFar.filter(({name}) => !members.some(mem => mem.name === name))

      if (missing.length > 0) {
        break
      }
    }

    expect(missing.length).toStrictEqual(0)

    const reconstructedMMPT = await MMPT.fromCID(await mmpt.put())

    const reMembers = await reconstructedMMPT.members()
    missing = soFar.filter(({name}) => !reMembers.some(mem => mem.name === name))

    expect(missing.length).toStrictEqual(0)
  })
})
