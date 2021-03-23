import * as util from './util'

describe('removes a key from an object', () => {
  it('removes a key from an object', () => {
    const obj = { a: 1, b: 2 }
    expect(util.removeKeyFromObj(obj, 'b')).toEqual({ a: 1 })
  })

  it('removes the last key and returns an empty object', () => {
    const obj = { a: 1 }
    expect(util.removeKeyFromObj(obj, 'a')).toEqual({})
  })

  it('returns the same object when the key is missing', () => {
    const obj = { a: 1 }
    expect(util.removeKeyFromObj(obj, 'b')).toEqual({ a: 1 })
  })
})

describe('updates a value or removes a key from an object', () => {
  it('updates an object', () => {
    const obj = { a: 1 }
    expect(util.updateOrRemoveKeyFromObj(obj, 'a', 2)).toEqual({ a: 2 })
  })

  it('removes a key from an object', () => {
    const obj = { a: 1, b: 2 }
    expect(util.updateOrRemoveKeyFromObj(obj, 'b', null)).toEqual({ a: 1 })
  })

  it('adds a key when missing on an object', () => {
    const obj = { a: 1 }
    expect(util.updateOrRemoveKeyFromObj(obj, 'b', 2)).toEqual({ a: 1, b: 2 })
  })

  it('does not add a key when the update value is null', () => {
    const obj = { a: 1 }
    expect(util.updateOrRemoveKeyFromObj(obj, 'b', null)).toEqual({ a: 1 })
  })
})

describe('maps over an object', () => {
  it('adds one to each entry in an object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(util.mapObj(obj, ((val, key) => val + 1))).toEqual({ a: 2, b: 3, c: 4 })
  })

  it('nullifies each entry in an object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(util.mapObj(obj, ((val, key) => null))).toEqual({ a: null, b: null, c: null })
  })

  it('has no effect on an empty object', () => {
    const obj = {}
    expect(util.mapObj(obj, ((val, key) => null))).toEqual({})
  })

  it('sets each entries value to its key', () => {
    const obj = { a: 1, b: 2 }
    expect(util.mapObj(obj, ((val, key) => key))).toEqual({ a: 'a', b: 'b' })
  })
})

describe('async maps over an object', () => {
  it('adds one to each entry in an object', async () => {
    const obj = { a: 1, b: 2, c: 3 }
    async function addOne(val, key) { return val + 1 }
    expect(util.mapObjAsync(obj, addOne)).resolves.toEqual({ a: 2, b: 3, c: 4 })
  })

  it('nullifies each entry in an object', async () => {
    const obj = { a: 1, b: 2, c: 3 }
    async function nullify(val, key) { return null }
    expect(util.mapObjAsync(obj, nullify)).resolves.toEqual({ a: null, b: null, c: null })
  })

  it('has no effect on an empty object', async () => {
    const obj = {}
    async function nullify(val, key) { return null }
    expect(util.mapObjAsync(obj, nullify)).resolves.toEqual({})
  })

  it('sets each entries value to its key', async () => {
    const obj = { a: 1, b: 2 }
    async function setToKey(val, key) { return key }
    expect(util.mapObjAsync(obj, setToKey)).resolves.toEqual({ a: 'a', b: 'b' })
  })
})

describe('array contains', () => {
  it('returns true when an array contains an entry', () => {
    const arr = [1, 2, 3]
    expect(util.arrContains(arr, 2)).toBe(true);
  })

  it('returns false when an array does not contain an entry', () => {
    const arr = [1, 2, 3]
    expect(util.arrContains(arr, 0)).toBe(false);
  })

  it('returns false when an array is empty', () => {
    const arr = []
    expect(util.arrContains(arr, 1)).toBe(false);
  })
})

describe('async waterfall', () => {
  it('accumulates values returned from async calls', async () => {
    async function addOne(val) { return val + 1 }
    async function addTwo(val) { return val + 2 }
    async function addThree(val) { return val + 3 }
    expect(util.asyncWaterfall(0, [addOne, addTwo, addThree])).resolves.toEqual(6)
  })

  it('concatenates characters returned from async calls', async () => {
    async function concatB(val) { return val + 'b' }
    async function concatC(val) { return val + 'c' }
    async function concatD(val) { return val + 'd' }
    expect(util.asyncWaterfall('a', [concatB, concatC, concatD])).resolves.toEqual('abcd')
  })

  it('returns the initial value when no waterfall', async () => {
    expect(util.asyncWaterfall(0, [])).resolves.toEqual(0)
  })
})