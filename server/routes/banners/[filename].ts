import { readFile } from 'node:fs/promises'
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
    const file = await readFile(getBannerAbsolutePath(filename))

    setResponseHeader(event, 'Content-Type', 'image/webp')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60')

    return file
  } catch {
    throw createError({ statusCode: 404, message: 'Banner no encontrado' })
  }
})
