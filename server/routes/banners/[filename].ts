import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import {
  getBannerAbsolutePath,
  getBannerFilenameFromPublicPath,
} from '#server-utils/adminImageUpload'

const ALLOWED_BANNER_EXTENSIONS = new Set(['.webp'])

export default defineEventHandler(async (event) => {
  const filenameParam = getRouterParam(event, 'filename')

  if (!filenameParam) {
    throw createError({ statusCode: 404, message: 'Banner no encontrado' })
  }

  const filename = getBannerFilenameFromPublicPath(filenameParam)
  const extension = filename ? extname(filename).toLowerCase() : ''

  if (!filename || !ALLOWED_BANNER_EXTENSIONS.has(extension)) {
    throw createError({ statusCode: 404, message: 'Banner no encontrado' })
  }

  try {
    const absolutePath = getBannerAbsolutePath(filename)
    const [file, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)])

    const lastModified = fileStat.mtime.toUTCString()
    const etag = `"${fileStat.size}-${fileStat.mtimeMs}"`

    if (
      getRequestHeader(event, 'if-none-match') === etag ||
      getRequestHeader(event, 'if-modified-since') === lastModified
    ) {
      setResponseStatus(event, 304)
      return null
    }

    setResponseHeader(event, 'Content-Type', 'image/webp')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, must-revalidate')
    setResponseHeader(event, 'Last-Modified', lastModified)
    setResponseHeader(event, 'ETag', etag)

    return file
  } catch {
    throw createError({ statusCode: 404, message: 'Banner no encontrado' })
  }
})
