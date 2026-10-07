// FILE: scripts/assets.mjs
// Image/video pipeline for everything under public/assets.
//
//   node scripts/assets.mjs optimize   Shrink oversized originals in place (run in CI before every build).
//   node scripts/assets.mjs variants   Generate responsive WebP variants + blur placeholders into
//                                      public/_variants and write src/generated/image-manifest.json.
//                                      Runs automatically before `npm run dev` and `npm run build`.
//   node scripts/assets.mjs check      Report assets over the limits (add --strict to exit non-zero).
//   node scripts/assets.mjs videos [files...]
//                                      Re-encode oversized videos in place with ffmpeg (local use only).
//
// Keep LIMITS in sync with media_libraries in public/admin/config.yml.

import { readdir, stat, mkdir, rm, writeFile, readFile, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const PUBLIC_DIR = path.join(ROOT, 'public')
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets')
const VARIANTS_DIR = path.join(PUBLIC_DIR, '_variants')
const MANIFEST_PATH = path.join(ROOT, 'src/generated/image-manifest.json')

const LIMITS = {
  imageMaxEdge: 2048, // px, longest side of an original image (matches the CMS upload transform)
  maxFileBytes: 5_000_000, // any single asset; matches max_file_size in public/admin/config.yml
}
// Originals above this are re-encoded by `optimize` (only kept if that saves 10%+).
const REENCODE_ABOVE_BYTES = 1_000_000
// Widths of the WebP copies served through srcset, plus one at the image's full width.
// Browsers only ever download these; the original is just the <img src> fallback.
const VARIANT_WIDTHS = [400, 800, 1600]
const PLACEHOLDER_WIDTH = 24

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm'])
const extOf = (file) => path.extname(file).toLowerCase()
const isRaster = (file) => RASTER_EXT.has(extOf(file))
const isVideo = (file) => VIDEO_EXT.has(extOf(file))
const rel = (file) => path.relative(ROOT, file)
const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`

async function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out.sort()
}

// Pixel size as displayed, i.e. after applying any EXIF rotation.
async function orientedSize(file) {
  const meta = await sharp(file).metadata()
  return meta.autoOrient ?? { width: meta.width, height: meta.height }
}

async function encodeLikeSource(pipeline, ext, originalBytes) {
  if (ext === '.webp') return pipeline.webp({ quality: 85 }).toBuffer()
  if (ext !== '.png') return pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
  const png = await pipeline.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
  // A PNG that grows when re-saved in full colour was already colour-reduced (e.g. by
  // pngquant), so reduce it to a palette again instead of bloating it.
  if (png.length <= originalBytes) return png
  return pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
}

// ---------------------------------------------------------------------------
// optimize: resize originals to LIMITS.imageMaxEdge and re-encode heavy files,
// keeping the same filename and format so content JSON references stay valid.
// ---------------------------------------------------------------------------
async function optimize() {
  let saved = 0
  for (const file of await walk(ASSETS_DIR)) {
    if (!isRaster(file)) continue
    const before = (await stat(file)).size
    const { width, height } = await orientedSize(file)
    const tooLarge = Math.max(width, height) > LIMITS.imageMaxEdge
    if (!tooLarge && before <= REENCODE_ABOVE_BYTES) continue

    const pipeline = sharp(file)
      .rotate() // bake in EXIF orientation, since metadata is stripped on output
      .resize({ width: LIMITS.imageMaxEdge, height: LIMITS.imageMaxEdge, fit: 'inside', withoutEnlargement: true })
    const output = await encodeLikeSource(pipeline, extOf(file), before)

    // Without a resize, only keep the re-encode if it saves at least 10%. This stops
    // repeated runs from recompressing the same file over and over.
    if (!tooLarge && output.length > before * 0.9) continue

    await writeFile(file, output)
    saved += before - output.length
    console.log(`optimized ${rel(file)}: ${width}x${height} ${mb(before)} -> ${mb(output.length)}`)
  }
  console.log(`optimize: saved ${mb(saved)} in total`)
}

// ---------------------------------------------------------------------------
// variants: responsive WebP copies + manifest consumed by ProgressiveImage.
// ---------------------------------------------------------------------------
async function variants() {
  let previous = {}
  try {
    previous = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  } catch {
    // No manifest yet: build everything.
  }

  const manifest = {}
  const expected = new Set()
  let generated = 0

  for (const file of await walk(ASSETS_DIR)) {
    if (!isRaster(file)) continue
    const key = path.relative(PUBLIC_DIR, file).split(path.sep).join('/') // e.g. assets/uploads/foo.jpg
    const outBase = path.join(VARIANTS_DIR, key.replace(/\.[^./]+$/, ''))
    const { size, mtimeMs } = await stat(file)

    const old = previous[key]
    const outputsFor = (entry) => [...entry.variants.map((w) => `${outBase}-${w}.webp`), `${outBase}-blur.webp`]
    if (old && old.size === size && old.mtimeMs === mtimeMs && outputsFor(old).every((f) => existsSync(f))) {
      manifest[key] = old
      outputsFor(old).forEach((f) => expected.add(f))
      continue
    }

    const { width, height } = await orientedSize(file)
    const entry = { width, height, variants: [...VARIANT_WIDTHS.filter((w) => w < width), width], size, mtimeMs }
    await mkdir(path.dirname(outBase), { recursive: true })
    for (const w of entry.variants) {
      await sharp(file).rotate().resize({ width: w }).webp({ quality: 80 }).toFile(`${outBase}-${w}.webp`)
    }
    await sharp(file).rotate().resize({ width: PLACEHOLDER_WIDTH }).webp({ quality: 50 }).toFile(`${outBase}-blur.webp`)
    manifest[key] = entry
    outputsFor(entry).forEach((f) => expected.add(f))
    generated++
  }

  // Remove variants whose source image was deleted or renamed.
  for (const file of await walk(VARIANTS_DIR)) {
    if (!expected.has(file)) await rm(file)
  }

  // Only rewrite the manifest when it changed, so the dev server doesn't reload for nothing.
  const json = JSON.stringify(manifest, null, 2) + '\n'
  let current = ''
  try {
    current = await readFile(MANIFEST_PATH, 'utf8')
  } catch {
    // Missing manifest is written below.
  }
  if (json !== current) {
    await mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
    await writeFile(MANIFEST_PATH, json)
  }
  console.log(`variants: ${Object.keys(manifest).length} images, ${generated} (re)generated`)
}

// ---------------------------------------------------------------------------
// check: list assets over the limits. In GitHub Actions the problems are also
// emitted as annotations so they show up on the workflow run.
// ---------------------------------------------------------------------------
async function check({ strict }) {
  const problems = []
  for (const file of await walk(ASSETS_DIR)) {
    const { size } = await stat(file)
    if (isRaster(file)) {
      const { width, height } = await orientedSize(file)
      if (Math.max(width, height) > LIMITS.imageMaxEdge) {
        problems.push([file, `image is ${width}x${height}, limit is ${LIMITS.imageMaxEdge}px on the longest side`])
        continue
      }
    }
    if (size > LIMITS.maxFileBytes) {
      const hint = isVideo(file) ? ` (compress with: npm run assets:videos -- "${rel(file)}")` : ''
      problems.push([file, `file is ${mb(size)}, limit is ${mb(LIMITS.maxFileBytes)}${hint}`])
    }
  }

  const level = strict ? 'error' : 'warning'
  for (const [file, message] of problems) {
    if (process.env.GITHUB_ACTIONS) console.log(`::${level} file=${rel(file)}::${message}`)
    else console.log(`${level}: ${rel(file)}: ${message}`)
  }
  console.log(`check: ${problems.length} asset(s) over the limits`)
  if (strict && problems.length) process.exit(1)
}

// ---------------------------------------------------------------------------
// videos: re-encode to H.264 with the long side capped at 1280px (then 960px if
// still too big). Only replaces the file when the result is smaller.
// ---------------------------------------------------------------------------
const VIDEO_PASSES = [
  { maxEdge: 1280, crf: 28 },
  { maxEdge: 960, crf: 32 },
]

async function videos(files) {
  let targets = files.map((f) => path.resolve(f))
  if (!targets.length) {
    for (const file of await walk(ASSETS_DIR)) {
      if (isVideo(file) && (await stat(file)).size > LIMITS.maxFileBytes) targets.push(file)
    }
  }

  for (const file of targets) {
    if (!['.mp4', '.mov'].includes(extOf(file))) {
      console.log(`skipping ${rel(file)}: only .mp4/.mov are re-encoded`)
      continue
    }
    const before = (await stat(file)).size
    const tmp = `${file}.tmp${extOf(file)}`
    let after = Infinity
    for (const { maxEdge, crf } of VIDEO_PASSES) {
      const scale = `scale='if(gte(iw,ih),min(${maxEdge},iw),-2)':'if(gte(iw,ih),-2,min(${maxEdge},ih))'`
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', file,
        '-map', '0:v:0', '-map', '0:a:0?',
        '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', tmp,
      ], { stdio: 'inherit' })
      after = (await stat(tmp)).size
      if (after <= LIMITS.maxFileBytes) break
    }
    if (after < before) {
      await rename(tmp, file)
      console.log(`compressed ${rel(file)}: ${mb(before)} -> ${mb(after)}${after > LIMITS.maxFileBytes ? ' (still over the limit; trim it)' : ''}`)
    } else {
      await rm(tmp)
      console.log(`kept ${rel(file)}: re-encoding did not make it smaller`)
    }
  }
}

const [command, ...args] = process.argv.slice(2)
const commands = {
  optimize: () => optimize(),
  variants: () => variants(),
  check: () => check({ strict: args.includes('--strict') }),
  videos: () => videos(args),
}
if (!commands[command]) {
  console.error('usage: node scripts/assets.mjs <optimize|variants|check [--strict]|videos [files...]>')
  process.exit(1)
}
await commands[command]()
