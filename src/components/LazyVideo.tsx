// FILE: src/components/LazyVideo.tsx
import { useEffect, useRef } from 'react'

interface LazyVideoProps {
  src: string;
  className?: string;
}

// A muted looping video that only loads and plays while it is on screen, and drops its
// buffered data once it scrolls away. The Join page's highlight strip repeats every
// highlight several times, so plain autoPlay would decode dozens of videos at once,
// which is enough to crash mobile Safari.
export const LazyVideo = ({ src, className }: LazyVideoProps) => {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    const unload = () => {
      video.pause()
      video.removeAttribute('src')
      video.load() // releases the decoder and buffered media
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!video.hasAttribute('src')) video.src = src
        // play() rejects when autoplay is blocked (e.g. iOS Low Power Mode); the card stays static.
        video.play().catch(() => {})
      } else if (video.hasAttribute('src')) {
        unload()
      }
    }, { rootMargin: '200px' })

    observer.observe(video)
    return () => {
      observer.disconnect()
      unload()
    }
  }, [src])

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      className={className}
    />
  )
}
