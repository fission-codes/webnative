export const notNull = <T>(obj: T | null): obj is T => {
  return obj !== null
}

export const isBool = (obj: any): obj is boolean => {
  return typeof obj === 'boolean'
}

export const isNum = (obj: any): obj is number => {
  return typeof obj === 'number'
}

export const isString = (obj: any): obj is string => {
  return typeof obj === 'string'
}

export const isObject = (obj: any): obj is object => {
  return obj !== null && typeof obj === 'object'
}

export const isBlob = (obj: any): obj is Blob => {
  if (typeof Blob === 'undefined') {
    return false
  }
  return obj instanceof Blob || obj.constructor.name === 'Blob'
}

export const blobToBuffer = async (blob: Blob): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("Failed to read file"))
    const reader = new FileReader()
    reader.addEventListener('load', (e) => {
      const arrbuf = e?.target?.result || null
      if(arrbuf === null){
        fail()
      }
      resolve(Buffer.from(arrbuf as ArrayBuffer))
    })
    reader.addEventListener('error', () => reader.abort())
    reader.addEventListener('abort', fail)
    reader.readAsArrayBuffer(blob)
  })
}

export const mapObj = <T, S>(obj: {[k: string]: T}, fn: (t: T, k?: string) => S): {[k: string]: S}  => {
  const newObj = {} as {[key: string]: S}
  Object.entries(obj).forEach(([key, value]) => {
    newObj[key] = fn(value, key)
  })
  return newObj
}

export const mapObjAsync = async <T, S>(obj: {[k: string]: T}, fn: (t: T, k?: string) => Promise<S>): Promise<{[k: string]: S}> => {
  const newObj = {} as {[key: string]: S}
  await Promise.all(
    Object.entries(obj).map(async ([key, value]) => {
      newObj[key] = await fn(value, key)
    })
  )
  return newObj
}



export default {
  notNull,
  isBool,
  isNum,
  isString,
  isObject,
  isBlob,
  blobToBuffer,
  mapObj,
  mapObjAsync,
}
