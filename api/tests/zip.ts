import { inflateRawSync } from 'node:zlib'
import type { ZipEntries } from '../types/tests.js'

const endOfCentralDirectory = 0x06054b50
const centralDirectoryHeader = 0x02014b50
const localFileHeader = 0x04034b50

export function readZip(archive: Buffer): ZipEntries {
  const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (
    endOffset === -1 ||
    archive.readUInt32LE(endOffset) !== endOfCentralDirectory
  ) {
    throw new Error('Not a ZIP archive')
  }
  const entryCount = archive.readUInt16LE(endOffset + 10)
  let offset = archive.readUInt32LE(endOffset + 16)
  const entries: ZipEntries = new Map()
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== centralDirectoryHeader) {
      throw new Error('Corrupted central directory')
    }
    const method = archive.readUInt16LE(offset + 10)
    const compressedSize = archive.readUInt32LE(offset + 20)
    const nameLength = archive.readUInt16LE(offset + 28)
    const extraLength = archive.readUInt16LE(offset + 30)
    const commentLength = archive.readUInt16LE(offset + 32)
    const localOffset = archive.readUInt32LE(offset + 42)
    const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength)
    if (archive.readUInt32LE(localOffset) !== localFileHeader) {
      throw new Error(`Corrupted local header for ${name}`)
    }
    const dataStart =
      localOffset +
      30 +
      archive.readUInt16LE(localOffset + 26) +
      archive.readUInt16LE(localOffset + 28)
    const data = archive.subarray(dataStart, dataStart + compressedSize)
    entries.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
