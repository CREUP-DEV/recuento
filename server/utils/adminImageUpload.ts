import { createError } from 'h3'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import sharp from 'sharp'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'] as const

const MAX_FILE_SIZE = 5 * 1024 * 1024
// 10000px per side: prevents decompression bomb while covering legitimate large images
const MAX_RASTER_DIMENSION = 10_000
// ~80MP total pixel cap across all frames; prevents memory exhaustion
const MAX_RASTER_PIXELS = 80_000_000
// 100 frame limit for animated GIFs/WebP; prevents CPU exhaustion
const MAX_RASTER_FRAMES = 100

function validateRasterMetadata(metadata: sharp.Metadata) {
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const frames = metadata.pages ?? 1

  if (width <= 0 || height <= 0) {
    throw createError({ statusCode: 400, message: 'La imagen tiene dimensiones no válidas' })
  }

  if (width > MAX_RASTER_DIMENSION || height > MAX_RASTER_DIMENSION) {
    throw createError({
      statusCode: 400,
      message: `Dimensiones demasiado grandes (máx. ${MAX_RASTER_DIMENSION}px por lado)`,
    })
  }

  if (frames > MAX_RASTER_FRAMES) {
    throw createError({
      statusCode: 400,
      message: `Demasiados fotogramas (máx. ${MAX_RASTER_FRAMES})`,
    })
  }

  if (width * height * frames > MAX_RASTER_PIXELS) {
    throw createError({
      statusCode: 400,
      message: 'Demasiados píxeles para procesar de forma segura',
    })
  }
}

export interface SaveBannerOptions {
  data: Buffer
  filename: string
  slug: string
  uploadDir?: string
  publicPath?: string
}

export async function saveBannerImage({
  data,
  filename,
  slug,
  uploadDir = 'public/banners',
  publicPath = '/banners',
}: SaveBannerOptions): Promise<string> {
  if (data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, message: 'El archivo supera el tamaño máximo (5MB)' })
  }

  const ext = extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw createError({
      statusCode: 400,
      message: `Formato no permitido. Formatos admitidos: ${ALLOWED_EXTENSIONS.join(', ')}`,
    })
  }

  // Single Sharp instance — decode once for both metadata check and conversion
  const image = sharp(data, { animated: true, limitInputPixels: MAX_RASTER_PIXELS })
  const metadata = await image.metadata()
  validateRasterMetadata(metadata)

  let outputData: Buffer
  try {
    outputData = await image.rotate().webp({ quality: 82 }).toBuffer()
  } catch {
    throw createError({ statusCode: 400, message: 'La imagen subida no se ha podido procesar' })
  }

  const outputFilename = `${slug}.webp`
  const absoluteDir = join(process.cwd(), uploadDir)
  await mkdir(absoluteDir, { recursive: true })
  await writeFile(join(absoluteDir, outputFilename), outputData)

  return `${publicPath}/${outputFilename}`
}
