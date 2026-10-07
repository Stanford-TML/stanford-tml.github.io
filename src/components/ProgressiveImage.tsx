// FILE: src/components/ProgressiveImage.tsx
import { useState, useEffect } from 'react'
import { getResponsiveImage } from '../utils/images'

interface ProgressiveImageProps {
  lowResSrc?: string;
  highResSrc: string;
  alt: string;
  containerClass?: string;
  imageClass?: string;
  // How wide the image is displayed, so the browser can pick the smallest file that's sharp enough.
  sizes?: string;
  // Use 'eager' for images visible on first paint.
  loading?: 'lazy' | 'eager';
}

export const ProgressiveImage = ({
  lowResSrc,
  highResSrc,
  alt,
  containerClass = "",
  imageClass = "",
  sizes = "100vw",
  loading = "lazy"
}: ProgressiveImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showLowRes, setShowLowRes] = useState(true)
  const [lowResError, setLowResError] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => setShowLowRes(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoaded])

  const fitClasses =['object-cover', 'object-contain', 'object-fill', 'object-none', 'object-scale-down']
  const hasObjectFit = fitClasses.some(cls => imageClass.includes(cls))
  const defaultFit = hasObjectFit ? '' : 'object-cover'

  // Local images get resized WebP copies and a blurred placeholder from the build step.
  const { srcSet, placeholder, width, height } = getResponsiveImage(highResSrc)
  const actualLowResSrc = lowResSrc || placeholder

  return (
    <div className={`relative overflow-hidden ${containerClass}`}>

      {/* Low Res Placeholder (Blurred) */}
      {actualLowResSrc && showLowRes && !lowResError && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.5s ease-in-out'
          }}
        >
          <img
            src={actualLowResSrc}
            alt={`Placeholder for ${alt}`}
            loading={loading}
            className={`w-full h-full ${defaultFit} ${imageClass}`}
            style={{ filter: 'blur(10px)' }}
            onError={() => setLowResError(true)}
          />
        </div>
      )}

      {/* High Res Main Image */}
      <div
        className="w-full h-full"
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.7s ease-in-out'
        }}
      >
        <img
          src={highResSrc}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          width={width}
          height={height}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full ${defaultFit} ${imageClass}`}
        />
      </div>

    </div>
  )
}
