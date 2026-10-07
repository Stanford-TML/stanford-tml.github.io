// Responsive image lookup for files under public/assets.
//
// `scripts/assets.mjs variants` (run before `npm run dev` / `npm run build`) writes resized
// WebP copies to public/_variants and lists them in src/generated/image-manifest.json.
// The manifest is loaded through a glob so that, if it is missing, images simply fall
// back to the original file.

type ImageInfo = { width: number; height: number; variants: number[] }

const manifestModules = import.meta.glob<Record<string, ImageInfo>>('/src/generated/image-manifest.json', { eager: true, import: 'default' })
const IMAGE_MANIFEST = Object.values(manifestModules)[0] ?? {}

// Manifest keys are paths relative to public/, e.g. "assets/uploads/foo.jpg".
const manifestKey = (src: string) => {
  const path = src.replace(/^\//, '').split(/[?#]/)[0]
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

// Spaces and commas would break srcset parsing, so encode them.
const variantUrl = (key: string, suffix: string) =>
  encodeURI(`${import.meta.env.BASE_URL}_variants/${key.replace(/\.[^./]+$/, '')}-${suffix}`).replace(/,/g, '%2C')

export interface ResponsiveImage {
  srcSet?: string;
  placeholder?: string;
  width?: number;
  height?: number;
}

export const getResponsiveImage = (src: string | undefined): ResponsiveImage => {
  if (!src || /^[a-z]+:/i.test(src)) return {}
  const key = manifestKey(src)
  const info = IMAGE_MANIFEST[key]
  if (!info) return {}
  return {
    srcSet: info.variants.map(w => `${variantUrl(key, `${w}.webp`)} ${w}w`).join(', '),
    placeholder: variantUrl(key, 'blur.webp'),
    width: info.width,
    height: info.height,
  }
}
