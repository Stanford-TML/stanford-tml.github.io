// FILE: src/components/ProgressiveImage.tsx
import { useState, useEffect } from 'react'

interface ProgressiveImageProps {
  lowResSrc?: string;
  highResSrc: string;
  alt: string;
  containerClass?: string;
  imageClass?: string;
}

export const ProgressiveImage = ({ 
  lowResSrc, 
  highResSrc, 
  alt, 
  containerClass = "", 
  imageClass = "" 
}: ProgressiveImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const[showLowRes, setShowLowRes] = useState(true)
  
  // NEW: Track if the low-res image throws a 404 error
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

  return (
    <div className={`relative overflow-hidden ${containerClass}`}>
      
      {/* Low Res Placeholder (Blurred) */}
      {/* NEW: Only render if lowResError is false */}
      {lowResSrc && showLowRes && !lowResError && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.5s ease-in-out'
          }}
        >
          <img 
            src={lowResSrc} 
            alt={`Placeholder for ${alt}`} 
            className={`w-full h-full ${defaultFit} ${imageClass}`}
            style={{ filter: 'blur(10px)' }}
            // NEW: If the image 404s, trigger the error state
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
          alt={alt} 
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full ${defaultFit} ${imageClass}`}
        />
      </div>
      
    </div>
  )
}