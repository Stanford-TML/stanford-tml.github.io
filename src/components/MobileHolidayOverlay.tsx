// FILE: src/components/MobileHolidayOverlay.tsx
// Pure 2D holiday overlay (zero Three.js dependencies) for Mobile / Lite Mode (`MobileHome.tsx`).
import { useEffect, useRef, useMemo } from 'react'
import { type HolidayType, getUpcomingYear, useHoliday, isMajorHoliday } from '../utils/holiday'

// ---------------------------------------------------------------------------
// 1. MARGIN BACKGROUND PALETTES
// ---------------------------------------------------------------------------

export const getMobileHolidayMarginStyle = (
  holiday: HolidayType
): React.CSSProperties => {
  if (holiday === 'winter') {
    return {
      background:
        'linear-gradient(180deg, #b8cbe0 0%, #cddbe9 45%, #e2ebf4 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'halloween') {
    return {
      background:
        'linear-gradient(180deg, #161024 0%, #241738 55%, #381e30 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'newyear') {
    return {
      background:
        'linear-gradient(180deg, #070912 0%, #0e1324 55%, #171d36 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'easter') {
    return {
      background:
        'linear-gradient(180deg, #e8f5e9 0%, #fff9c4 45%, #fce4ec 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'valentines') {
    return {
      background:
        'linear-gradient(180deg, #fff0f3 0%, #ffccd5 55%, #ffb3c1 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'stpatricks') {
    return {
      background:
        'linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
      transition: 'background 0.4s ease'
    }
  }
  if (holiday === 'thanksgiving') {
    return {
      background:
        'linear-gradient(180deg, #fff3e0 0%, #ffe0b2 50%, #ffcc80 100%)',
      transition: 'background 0.4s ease'
    }
  }
  return {
    backgroundColor: '#e0e0e0'
  }
}

// ---------------------------------------------------------------------------
// 2. 2D CANVAS PARTICLE & FIREWORKS OVERLAY
// ---------------------------------------------------------------------------

interface Particle2D {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  phase: number
  speed: number
  color: string
}

interface FireworkSpark2D {
  x: number
  y: number
  prevX: number
  prevY: number
  vx: number
  vy: number
  color: string
  alpha: number
}

interface FireworkRocket2D {
  phase: 'cooldown' | 'ascending' | 'exploding'
  timer: number
  duration: number
  x: number
  y: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  c1: string
  c2: string
  sparks: FireworkSpark2D[]
}

const NYE_PALETTES: [string, string][] = [
  ['#ffd700', '#fff4b8'],
  ['#ff2e4c', '#ffae00'],
  ['#00f0ff', '#a855f7'],
  ['#38ff7a', '#ffd700'],
  ['#ff45e6', '#70d6ff']
]

export const MobileHolidayCanvas = ({ holiday }: { holiday: HolidayType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!holiday || !isMajorHoliday(holiday)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize ambient particles for major holidays
    const count = holiday === 'winter' ? 95 : holiday === 'easter' ? 70 : 65
    const particles: Particle2D[] = []

    const pickColor = () => {
      if (holiday === 'winter') {
        return Math.random() < 0.75 ? '#ffffff' : '#d8ecff'
      }
      if (holiday === 'easter') {
        const r = Math.random()
        if (r < 0.45) return '#ffb7d5' // Sakura petal
        if (r < 0.75) return '#ffccd5' // Soft blush
        if (r < 0.9) return '#cbf3f0'  // Spring mint
        return '#ffe484'               // Golden pollen
      }
      if (holiday === 'halloween') {
        const r = Math.random()
        if (r < 0.5) return '#ff6a00'
        if (r < 0.8) return '#ffa600'
        return '#b84dff'
      }
      // newyear
      const r = Math.random()
      if (r < 0.55) return '#ffd700'
      if (r < 0.85) return '#fff1b8'
      return '#ffffff'
    }

    for (let i = 0; i < count; i++) {
      const isDownward = holiday === 'winter' || holiday === 'easter'
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (holiday === 'easter' ? 26 : 22),
        vy:
          holiday === 'winter'
            ? 28 + Math.random() * 45
            : holiday === 'easter'
            ? 20 + Math.random() * 32
            : -(20 + Math.random() * 38),
        r:
          holiday === 'winter'
            ? 1.8 + Math.random() * 3.2
            : holiday === 'easter'
            ? 2.2 + Math.random() * 2.8
            : 1.6 + Math.random() * 2.8,
        alpha: 0.35 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
        color: pickColor()
      })
    }

    // Initialize 2D fireworks for New Year's (preferring the left/right margins on wide screens)
    const rockets: FireworkRocket2D[] = []
    if (holiday === 'newyear') {
      for (let r = 0; r < 3; r++) {
        rockets.push({
          phase: 'cooldown',
          timer: r === 0 ? 0.3 : 1.0 + r * 1.3,
          duration: 1.0,
          x: 0,
          y: 0,
          startX: 0,
          startY: 0,
          targetX: 0,
          targetY: 0,
          c1: '#ffd700',
          c2: '#ffffff',
          sparks: []
        })
      }
    }

    const launchRocket = (rk: FireworkRocket2D) => {
      rk.phase = 'ascending'
      rk.timer = 0
      rk.duration = 0.55 + Math.random() * 0.25

      // Aim bursts into the left or right margin if wide enough, otherwise across top sky
      const centerColWidth = Math.min(896, width)
      const marginWidth = Math.max(0, (width - centerColWidth) / 2)
      let launchX: number
      if (marginWidth > 70) {
        const leftSide = Math.random() < 0.5
        launchX = leftSide
          ? 24 + Math.random() * (marginWidth - 36)
          : width - marginWidth + 12 + Math.random() * (marginWidth - 36)
      } else {
        launchX = 40 + Math.random() * Math.max(80, width - 80)
      }

      rk.startX = launchX
      rk.startY = height + 10
      rk.targetX = launchX + (Math.random() - 0.5) * 50
      rk.targetY = 70 + Math.random() * (height * 0.45)
      rk.x = rk.startX
      rk.y = rk.startY

      const pal = NYE_PALETTES[Math.floor(Math.random() * NYE_PALETTES.length)]
      rk.c1 = pal[0]
      rk.c2 = pal[1]
    }

    const explodeRocket = (rk: FireworkRocket2D) => {
      rk.phase = 'exploding'
      rk.timer = 0
      rk.duration = 1.35 + Math.random() * 0.35
      rk.sparks = []
      const numSparks = 44
      for (let i = 0; i < numSparks; i++) {
        const angle = (i / numSparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.15
        const speed = 45 + Math.random() * 95
        rk.sparks.push({
          x: rk.targetX,
          y: rk.targetY,
          prevX: rk.targetX,
          prevY: rk.targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() < 0.55 ? rk.c1 : rk.c2,
          alpha: 1.0
        })
      }
    }

    let rafId = 0
    let prevTime = performance.now()

    const animate = (now: number) => {
      const dt = Math.min((now - prevTime) / 1000, 0.05)
      prevTime = now
      const t = now / 1000

      ctx.clearRect(0, 0, width, height)

      // 1. Draw ambient particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += (p.vx + Math.sin(t * p.speed + p.phase) * 18) * dt
        p.y += p.vy * dt

        if (holiday === 'winter' || holiday === 'easter') {
          if (p.y > height + 12) {
            p.y = -10
            p.x = Math.random() * width
          }
        } else {
          if (p.y < -12) {
            p.y = height + 10
            p.x = Math.random() * width
          }
        }
        if (p.x < -12) p.x = width + 10
        if (p.x > width + 12) p.x = -10

        const twinkle =
          holiday === 'winter' || holiday === 'easter'
            ? 0.75 + 0.25 * Math.sin(t * 2.5 + p.phase)
            : 0.55 + 0.45 * Math.sin(t * 4.5 + p.phase)

        ctx.save()
        ctx.globalAlpha = p.alpha * twinkle
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = holiday === 'winter' || holiday === 'easter' ? 6 : 10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // 2. Draw New Year's fireworks
      if (holiday === 'newyear') {
        for (let r = 0; r < rockets.length; r++) {
          const rk = rockets[r]
          if (rk.phase === 'cooldown') {
            rk.timer -= dt
            if (rk.timer <= 0) launchRocket(rk)
          } else if (rk.phase === 'ascending') {
            rk.timer += dt
            const p = Math.min(1, rk.timer / rk.duration)
            const ease = 1 - (1 - p) * (1 - p)
            const prevX = rk.x
            const prevY = rk.y
            rk.x = rk.startX + (rk.targetX - rk.startX) * p
            rk.y = rk.startY + (rk.targetY - rk.startY) * ease

            ctx.save()
            ctx.strokeStyle = '#ffd700'
            ctx.lineWidth = 2.2
            ctx.shadowColor = '#ffd700'
            ctx.shadowBlur = 8
            ctx.beginPath()
            ctx.moveTo(prevX, prevY)
            ctx.lineTo(rk.x, rk.y)
            ctx.stroke()
            ctx.restore()

            if (p >= 1) explodeRocket(rk)
          } else if (rk.phase === 'exploding') {
            rk.timer += dt
            const p = Math.min(1, rk.timer / rk.duration)
            const fade = Math.pow(1 - p, 1.5)

            ctx.save()
            ctx.lineCap = 'round'
            for (let s = 0; s < rk.sparks.length; s++) {
              const sp = rk.sparks[s]
              sp.prevX = sp.x
              sp.prevY = sp.y
              sp.vx *= 1 - 1.8 * dt
              sp.vy = sp.vy * (1 - 1.8 * dt) + 85 * dt
              sp.x += sp.vx * dt
              sp.y += sp.vy * dt

              ctx.globalAlpha = fade
              ctx.strokeStyle = sp.color
              ctx.lineWidth = 2.0
              ctx.shadowColor = sp.color
              ctx.shadowBlur = 8
              ctx.beginPath()
              ctx.moveTo(sp.prevX, sp.prevY)
              ctx.lineTo(sp.x, sp.y)
              ctx.stroke()
            }
            ctx.restore()

            if (p >= 1) {
              rk.phase = 'cooldown'
              rk.timer = 0.8 + Math.random() * 2.2
            }
          }
        }
      }

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [holiday])

  if (!holiday || !isMajorHoliday(holiday)) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 30
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// 3. DIE-CUT SVG STICKERS FOR PAGE MARGINS & HEADER
// ---------------------------------------------------------------------------

const stickerWrapperStyle: React.CSSProperties = {
  filter:
    'drop-shadow(0px 6px 14px rgba(0, 0, 0, 0.22)) drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15))',
  userSelect: 'none',
  pointerEvents: 'none'
}

/** Cute die-cut Santa / Witch / NYE Top Hat sticker for the page title */
export const MobileTitleHatSticker = ({ holiday }: { holiday: HolidayType }) => {
  if (!holiday) return null

  if (holiday === 'winter') {
    return (
      <svg
        width="48"
        height="44"
        viewBox="0 0 64 58"
        style={{
          position: 'absolute',
          top: '-24px',
          left: '-16px',
          transform: 'rotate(-16deg)',
          filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.22))',
          pointerEvents: 'none'
        }}
      >
        {/* Red cone */}
        <path
          d="M12 42 C16 16, 36 8, 54 24 C44 26, 36 32, 46 42 Z"
          fill="#d61f1f"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Fluffy white brim */}
        <rect
          x="6"
          y="36"
          width="42"
          height="13"
          rx="6.5"
          fill="#ffffff"
          stroke="#e6eef7"
          strokeWidth="1.5"
        />
        {/* Pom-pom */}
        <circle cx="54" cy="25" r="7.5" fill="#ffffff" stroke="#e6eef7" strokeWidth="1.5" />
      </svg>
    )
  }

  if (holiday === 'halloween') {
    return (
      <svg
        width="52"
        height="48"
        viewBox="0 0 68 62"
        style={{
          position: 'absolute',
          top: '-28px',
          left: '-18px',
          transform: 'rotate(-14deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
          pointerEvents: 'none'
        }}
      >
        {/* White sticker outline */}
        <path
          d="M34 4 L48 44 L62 48 C44 55, 24 55, 6 48 L20 44 Z"
          fill="#231630"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Orange ribbon */}
        <path d="M19 40 L49 40 L51 46 L17 46 Z" fill="#ff6b00" />
        {/* Gold buckle */}
        <rect x="29" y="38.5" width="10" height="9" rx="1.5" fill="none" stroke="#ffd700" strokeWidth="2.5" />
      </svg>
    )
  }

  if (holiday === 'easter') {
    return (
      <svg
        width="50"
        height="50"
        viewBox="0 0 64 64"
        style={{
          position: 'absolute',
          top: '-30px',
          left: '-14px',
          transform: 'rotate(-10deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.22))',
          pointerEvents: 'none'
        }}
      >
        {/* Die-cut white backing */}
        <g stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          {/* Headband */}
          <path d="M12 48 Q32 38 52 48" fill="none" stroke="#ffffff" strokeWidth="7" />
          {/* Left ear */}
          <path d="M22 46 C16 32, 14 14, 23 8 C30 14, 30 32, 27 46 Z" fill="#ffffff" />
          {/* Right ear (floppy tip) */}
          <path d="M37 46 C36 30, 42 16, 52 14 C56 18, 54 26, 48 30 C44 34, 43 40, 42 46 Z" fill="#ffffff" />
        </g>
        {/* Headband base */}
        <path d="M14 48 Q32 39 50 48" fill="none" stroke="#f48fb1" strokeWidth="4" strokeLinecap="round" />
        {/* Left ear outer & inner pad */}
        <path d="M22 46 C16 32, 14 14, 23 8 C30 14, 30 32, 27 46 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
        <path d="M22 42 C18 30, 17 18, 23 12 C27 18, 27 30, 25 42 Z" fill="#ffb7d5" />
        {/* Right flopped ear outer & inner pad */}
        <path d="M37 46 C36 30, 42 16, 52 14 C56 18, 54 26, 48 30 C44 34, 43 40, 42 46 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
        <path d="M39 42 C38 31, 43 20, 50 18 C52 22, 50 25, 46 28 C42 32, 42 38, 41 42 Z" fill="#ffb7d5" />
        {/* Daisy flower at headband base */}
        <g transform="translate(18, 44)">
          <circle cx="0" cy="0" r="4.5" fill="#ffffff" />
          <circle cx="0" cy="0" r="2.2" fill="#ffd166" />
        </g>
      </svg>
    )
  }

  if (holiday === 'valentines') {
    return (
      <svg
        width="54"
        height="46"
        viewBox="0 0 68 56"
        style={{
          position: 'absolute',
          top: '-26px',
          left: '-16px',
          transform: 'rotate(-12deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
          pointerEvents: 'none'
        }}
      >
        {/* Golden Halo */}
        <ellipse cx="34" cy="14" rx="22" ry="7" fill="none" stroke="#ffffff" strokeWidth="6" />
        <ellipse cx="34" cy="14" rx="22" ry="7" fill="none" stroke="#ffd700" strokeWidth="3" />
        {/* Angel Wings */}
        <g fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5">
          <path d="M22 28 C12 20, 2 26, 6 36 C10 42, 20 38, 24 34 Z" />
          <path d="M46 28 C56 20, 66 26, 62 36 C58 42, 48 38, 44 34 Z" />
        </g>
        {/* Ruby Heart Gem in center */}
        <path
          d="M34 26 C31 20, 23 21, 23 27 C23 34, 34 42, 34 42 C34 42, 45 34, 45 27 C45 21, 37 20, 34 26 Z"
          fill="#d90429"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (holiday === 'stpatricks') {
    return (
      <svg
        width="50"
        height="48"
        viewBox="0 0 64 60"
        style={{
          position: 'absolute',
          top: '-27px',
          left: '-15px',
          transform: 'rotate(-12deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.28))',
          pointerEvents: 'none'
        }}
      >
        {/* White sticker border */}
        <g stroke="#ffffff" strokeWidth="4" strokeLinejoin="round">
          <rect x="18" y="10" width="28" height="34" rx="4" fill="#007f5f" />
          <ellipse cx="32" cy="44" rx="25" ry="6" fill="#007f5f" />
        </g>
        {/* Dark emerald brim and cylinder */}
        <rect x="18" y="10" width="28" height="34" rx="4" fill="#007f5f" />
        <ellipse cx="32" cy="44" rx="25" ry="6" fill="#007f5f" />
        {/* Black hat band */}
        <rect x="18.5" y="34" width="27" height="7" fill="#1b1d20" />
        {/* Gold buckle */}
        <rect x="27.5" y="32.5" width="9" height="10" rx="1.5" fill="none" stroke="#ffd700" strokeWidth="2.5" />
        {/* Shamrock in band */}
        <g transform="translate(43, 30) scale(0.65)">
          <circle cx="-5" cy="-3" r="4.5" fill="#52b788" />
          <circle cx="5" cy="-3" r="4.5" fill="#52b788" />
          <circle cx="0" cy="5" r="4.5" fill="#52b788" />
          <circle cx="0" cy="-5" r="4.5" fill="#52b788" />
          <path d="M0 4 Q3 14 6 18" stroke="#2d6a4f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    )
  }

  if (holiday === 'thanksgiving') {
    return (
      <svg
        width="50"
        height="48"
        viewBox="0 0 64 60"
        style={{
          position: 'absolute',
          top: '-27px',
          left: '-15px',
          transform: 'rotate(-12deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.28))',
          pointerEvents: 'none'
        }}
      >
        {/* White sticker outline */}
        <g stroke="#ffffff" strokeWidth="4" strokeLinejoin="round">
          <polygon points="21,12 43,12 45,43 19,43" fill="#2b2d42" />
          <ellipse cx="32" cy="44" rx="25" ry="6" fill="#2b2d42" />
        </g>
        {/* Hat body */}
        <polygon points="21,12 43,12 45,43 19,43" fill="#2b2d42" />
        <ellipse cx="32" cy="44" rx="25" ry="6" fill="#2b2d42" />
        {/* Burnt-orange autumn band */}
        <polygon points="19.5,35 44.5,35 45,42 19,42" fill="#c85a17" />
        {/* Brass buckle */}
        <rect x="27.5" y="33" width="9" height="10" rx="1.5" fill="none" stroke="#ffd166" strokeWidth="2.5" />
      </svg>
    )
  }

  if (holiday === 'newyear') {
    return (
      <svg
        width="48"
        height="46"
        viewBox="0 0 64 60"
        style={{
          position: 'absolute',
          top: '-27px',
          left: '-15px',
          transform: 'rotate(-14deg)',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))',
          pointerEvents: 'none'
        }}
      >
        <g stroke="#ffffff" strokeWidth="3.5" strokeLinejoin="round">
          <rect x="16" y="10" width="32" height="36" rx="4" fill="#181920" />
          <ellipse cx="32" cy="44" rx="26" ry="6" fill="#181920" />
        </g>
        <rect x="17.5" y="36" width="29" height="7" fill="#ffd700" />
        <polygon points="32,20 34.5,25.5 40.5,26.2 36,30.2 37.2,36 32,33 26.8,36 28,30.2 23.5,26.2 29.5,25.5" fill="#ffd700" />
      </svg>
    )
  }

  return null
}

/** Margin Stickers that live in the left & right gutters behind the center column */
export const MobileMarginStickers = ({ holiday }: { holiday: HolidayType }) => {
  const yearText = useMemo(() => getUpcomingYear(), [])

  if (!holiday) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      <style>{`
        @media (max-width: 895px) {
          .tml-margin-sticker {
            display: none !important;
          }
        }
        @keyframes floatStickerSlow {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50% { transform: translateY(-8px) rotate(-1deg); }
        }
        @keyframes floatStickerReverse {
          0%, 100% { transform: translateY(0px) rotate(6deg); }
          50% { transform: translateY(-7px) rotate(9deg); }
        }
        @keyframes neonFlicker2D {
          0%, 18%, 22%, 25%, 53%, 57%, 100% {
            opacity: 1;
            filter: drop-shadow(0 0 8px #ffd700) drop-shadow(0 0 20px rgba(255, 190, 0, 0.75));
          }
          20%, 24%, 55% {
            opacity: 0.42;
            filter: drop-shadow(0 0 2px #ffd700);
          }
        }
        @keyframes sleighFlyAcross2D {
          0% { transform: translate(-220px, 18px) rotate(-4deg); opacity: 0; }
          8% { opacity: 0.92; }
          50% { transform: translate(calc(50vw - 90px), -14px) rotate(2deg); opacity: 0.92; }
          92% { opacity: 0.92; }
          100% { transform: translate(calc(100vw + 220px), 10px) rotate(-3deg); opacity: 0; }
        }
      `}</style>

      {/* ==================== WINTER STICKERS ==================== */}
      {holiday === 'winter' && (
        <>
          {/* Subtle flying sleigh silhouette across the top sky */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              top: '74px',
              left: 0,
              animation: 'sleighFlyAcross2D 18s linear infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="150" height="44" viewBox="0 0 200 58">
              <g fill="#8C1515" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
                {/* Sleigh body */}
                <path d="M18 32 C18 18, 34 16, 58 20 L66 38 L24 38 Z" />
                {/* Sleigh runner */}
                <path d="M12 44 L76 44 C84 44, 88 38, 84 34" fill="none" stroke="#ffd700" strokeWidth="3.5" strokeLinecap="round" />
                {/* Reins */}
                <line x1="64" y1="28" x2="174" y2="30" stroke="#ffd700" strokeWidth="2" strokeDasharray="4 3" />
                {/* 3 Robot Dogs pulling */}
                {[98, 134, 170].map((dx, i) => (
                  <g key={i} transform={`translate(${dx}, 20)`}>
                    <rect x="0" y="6" width="18" height="8" rx="3" fill="#2e2d29" stroke="#ffffff" strokeWidth="2.5" />
                    <circle cx="19" cy="6" r="4" fill="#8C1515" stroke="#ffffff" strokeWidth="2" />
                    <line x1="3" y1="14" x2="0" y2="23" stroke="#2e2d29" strokeWidth="3" strokeLinecap="round" />
                    <line x1="15" y1="14" x2="19" y2="23" stroke="#2e2d29" strokeWidth="3" strokeLinecap="round" />
                  </g>
                ))}
              </g>
            </svg>
          </div>

          {/* Left Margin: Die-Cut Christmas Tree Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '115px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 65px))',
              animation: 'floatStickerSlow 5.5s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="128" height="164" viewBox="0 0 140 180">
              {/* Die-cut white sticker backing */}
              <g stroke="#ffffff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round">
                <rect x="56" y="138" width="28" height="26" rx="4" fill="#ffffff" />
                <polygon points="70,18 28,74 112,74" fill="#ffffff" />
                <polygon points="70,48 20,110 120,110" fill="#ffffff" />
                <polygon points="70,80 14,144 126,144" fill="#ffffff" />
              </g>
              {/* Trunk */}
              <rect x="56" y="138" width="28" height="26" rx="4" fill="#6e472b" />
              {/* Foliage tiers */}
              <polygon points="70,80 14,144 126,144" fill="#135918" />
              <polygon points="70,48 20,110 120,110" fill="#1b6e21" />
              <polygon points="70,18 28,74 112,74" fill="#238229" />
              {/* Snow tips on branches */}
              <path d="M28 74 Q49 68 70 74 Q91 68 112 74" fill="none" stroke="#f2f7fc" strokeWidth="5" strokeLinecap="round" />
              <path d="M20 110 Q45 102 70 110 Q95 102 120 110" fill="none" stroke="#f2f7fc" strokeWidth="5" strokeLinecap="round" />
              {/* Ornaments */}
              <circle cx="52" cy="64" r="5.5" fill="#e52b2b" />
              <circle cx="85" cy="92" r="6" fill="#ffd700" />
              <circle cx="44" cy="100" r="5.5" fill="#2080ff" />
              <circle cx="94" cy="128" r="6" fill="#e52b2b" />
              <circle cx="52" cy="130" r="5.5" fill="#30ff70" />
              <circle cx="72" cy="118" r="5" fill="#ffd700" />
              {/* Golden Top Star */}
              <polygon
                points="70,6 74,15 84,16 76.5,22.5 78.5,32 70,27 61.5,32 63.5,22.5 56,16 66,15"
                fill="#ffd700"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          {/* Right Margin: Tilted Low-Poly Snowman Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '45px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 58px))',
              animation: 'floatStickerReverse 6.2s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="116" height="148" viewBox="0 0 130 165">
              <g stroke="#ffffff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round">
                <circle cx="65" cy="120" r="34" fill="#ffffff" />
                <circle cx="65" cy="76" r="25" fill="#ffffff" />
                <circle cx="65" cy="40" r="18" fill="#ffffff" />
                <rect x="47" y="10" width="36" height="18" rx="3" fill="#ffffff" />
              </g>
              {/* Snowballs */}
              <circle cx="65" cy="120" r="34" fill="#f4f8fc" stroke="#d0deec" strokeWidth="2" />
              <circle cx="65" cy="76" r="25" fill="#f7fafe" stroke="#d0deec" strokeWidth="2" />
              <circle cx="65" cy="40" r="18" fill="#ffffff" stroke="#d0deec" strokeWidth="2" />
              {/* Red Scarf */}
              <path d="M45 52 Q65 60 85 52 L82 60 Q65 67 48 60 Z" fill="#c41e1e" />
              <path d="M74 56 L80 82 L70 84 L67 58 Z" fill="#d62828" />
              {/* Carrot nose & coal eyes/buttons */}
              <polygon points="65,39 86,43 65,45" fill="#ff7300" />
              <circle cx="59" cy="35" r="2.6" fill="#222" />
              <circle cx="71" cy="35" r="2.6" fill="#222" />
              <circle cx="65" cy="70" r="3" fill="#222" />
              <circle cx="65" cy="82" r="3" fill="#222" />
              <circle cx="65" cy="106" r="3.2" fill="#222" />
              {/* Top Hat */}
              <rect x="44" y="22" width="42" height="5" rx="2.5" fill="#222" />
              <rect x="51" y="7" width="28" height="17" rx="2" fill="#222" />
              <rect x="51" y="19" width="28" height="4" fill="#c41e1e" />
            </svg>
          </div>
        </>
      )}

      {/* ==================== HALLOWEEN STICKERS ==================== */}
      {holiday === 'halloween' && (
        <>
          {/* Left Margin: Glowing Jack-o'-Lantern Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '115px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 58px))',
              animation: 'floatStickerSlow 5s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="118" height="114" viewBox="0 0 130 124">
              {/* Die-cut white border */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round">
                <path d="M58 14 C60 6, 70 6, 74 14 L70 28 L58 28 Z" fill="#ffffff" />
                <ellipse cx="65" cy="72" rx="48" ry="38" fill="#ffffff" />
              </g>
              {/* Stem */}
              <path d="M58 14 C60 6, 70 6, 74 14 L70 28 L58 28 Z" fill="#3a5f27" />
              {/* Pumpkin ribs */}
              <ellipse cx="65" cy="72" rx="48" ry="38" fill="#e85d04" />
              <ellipse cx="65" cy="72" rx="34" ry="38" fill="#f47108" />
              <ellipse cx="65" cy="72" rx="18" ry="38" fill="#ff850a" />
              {/* Glowing carved eyes, nose, and grin */}
              <g fill="#ffea79" filter="drop-shadow(0 0 6px #ffae00)">
                <polygon points="44,52 56,64 36,64" />
                <polygon points="86,52 94,64 74,64" />
                <polygon points="65,62 71,72 59,72" />
                <path d="M36 78 L48 86 L56 80 L65 88 L74 80 L82 86 L94 78 L86 94 L74 90 L65 96 L56 90 L44 94 Z" />
              </g>
            </svg>
          </div>

          {/* Right Margin: Spooky Bats & Haunted Moon Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              top: '120px',
              right: 'max(16px, calc((100vw - 896px) / 4 - 55px))',
              animation: 'floatStickerReverse 5.8s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="114" height="114" viewBox="0 0 120 120">
              <circle
                cx="64"
                cy="58"
                r="38"
                fill="#ffd166"
                stroke="#ffffff"
                strokeWidth="6"
              />
              {/* Bat silhouette */}
              <path
                d="M20 56 C30 44, 42 46, 52 54 L56 48 L60 52 L64 48 L68 54 C78 46, 90 44, 100 56 C88 54, 82 62, 76 68 C68 62, 62 66, 60 72 C58 66, 52 62, 44 68 C38 62, 32 54, 20 56 Z"
                fill="#1d1128"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </>
      )}

      {/* ==================== EASTER STICKERS ==================== */}
      {holiday === 'easter' && (
        <>
          {/* Left Margin: Woven Easter Basket Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '105px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 60px))',
              animation: 'floatStickerSlow 5.4s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="124" height="136" viewBox="0 0 130 142">
              {/* White die-cut backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                <path d="M26 68 L36 122 L94 122 L104 68 Z" fill="#ffffff" />
                <path d="M38 68 C38 28, 92 28, 92 68" fill="none" stroke="#ffffff" strokeWidth="12" />
              </g>
              {/* Handle */}
              <path d="M38 68 C38 28, 92 28, 92 68" fill="none" stroke="#a76d38" strokeWidth="7" />
              {/* Top Bow */}
              <circle cx="65" cy="30" r="7" fill="#ff80ab" />
              {/* Painted eggs in basket */}
              <g>
                <ellipse cx="48" cy="68" rx="13" ry="17" fill="#ff80ab" transform="rotate(-15 48 68)" />
                <ellipse cx="82" cy="68" rx="13" ry="17" fill="#70d6ff" transform="rotate(15 82 68)" />
                <ellipse cx="65" cy="62" rx="14" ry="18" fill="#ffd166" />
                {/* Decorative stripe on center egg */}
                <path d="M53 62 Q65 67 77 62" stroke="#ffffff" strokeWidth="3" fill="none" />
              </g>
              {/* Woven Basket body */}
              <path d="M26 68 L36 122 L94 122 L104 68 Z" fill="#b07238" />
              {/* Weave lines */}
              <path d="M26 68 Q65 76 104 68" stroke="#8a5323" strokeWidth="4" fill="none" />
              <path d="M29 86 Q65 94 101 86" stroke="#8a5323" strokeWidth="4" fill="none" />
              <path d="M33 104 Q65 111 97 104" stroke="#8a5323" strokeWidth="4" fill="none" />
              <line x1="50" y1="68" x2="52" y2="122" stroke="#8a5323" strokeWidth="3.5" />
              <line x1="80" y1="68" x2="78" y2="122" stroke="#8a5323" strokeWidth="3.5" />
            </svg>
          </div>

          {/* Right Margin: Hopping Easter Bunny Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '95px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 55px))',
              animation: 'floatStickerReverse 5.8s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="115" height="142" viewBox="0 0 120 148">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                {/* Ears */}
                <ellipse cx="48" cy="28" rx="9" ry="24" fill="#ffffff" transform="rotate(-8 48 28)" />
                <ellipse cx="70" cy="30" rx="9" ry="24" fill="#ffffff" transform="rotate(12 70 30)" />
                {/* Head */}
                <circle cx="58" cy="62" r="24" fill="#ffffff" />
                {/* Body */}
                <ellipse cx="62" cy="108" rx="28" ry="32" fill="#ffffff" />
                {/* Cottontail */}
                <circle cx="94" cy="116" r="12" fill="#ffffff" />
              </g>
              {/* Body & Head */}
              <ellipse cx="62" cy="108" rx="28" ry="32" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
              <circle cx="94" cy="116" r="11" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
              <circle cx="58" cy="62" r="23" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
              {/* Ears with pink pads */}
              <ellipse cx="48" cy="28" rx="9" ry="24" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" transform="rotate(-8 48 28)" />
              <ellipse cx="48" cy="28" rx="5" ry="17" fill="#ffb7d5" transform="rotate(-8 48 28)" />
              <ellipse cx="70" cy="30" rx="9" ry="24" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" transform="rotate(12 70 30)" />
              <ellipse cx="70" cy="30" rx="5" ry="17" fill="#ffb7d5" transform="rotate(12 70 30)" />
              {/* Face details */}
              <circle cx="50" cy="58" r="3" fill="#222" />
              <circle cx="68" cy="58" r="3" fill="#222" />
              <polygon points="56,66 62,66 59,70" fill="#f472b6" />
              {/* Rosy cheeks */}
              <circle cx="44" cy="65" r="4.5" fill="#fbcfe8" opacity="0.8" />
              <circle cx="74" cy="65" r="4.5" fill="#fbcfe8" opacity="0.8" />
            </svg>
          </div>
        </>
      )}

      {/* ==================== VALENTINE'S STICKERS ==================== */}
      {holiday === 'valentines' && (
        <>
          {/* Left Margin: Ruby Velvet Heart Box Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '105px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 58px))',
              animation: 'floatStickerSlow 5.2s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="124" height="120" viewBox="0 0 130 126">
              {/* White backing */}
              <path
                d="M65 116 C65 116, 12 76, 12 40 C12 18, 32 10, 50 20 C58 25, 65 34, 65 34 C65 34, 72 25, 80 20 C98 10, 118 18, 118 40 C118 76, 65 116, 65 116 Z"
                fill="#ffffff"
                stroke="#ffffff"
                strokeWidth="10"
                strokeLinejoin="round"
              />
              {/* Velvet Heart */}
              <path
                d="M65 116 C65 116, 12 76, 12 40 C12 18, 32 10, 50 20 C58 25, 65 34, 65 34 C65 34, 72 25, 80 20 C98 10, 118 18, 118 40 C118 76, 65 116, 65 116 Z"
                fill="#b91c1c"
              />
              {/* Golden Ribbon Cross */}
              <line x1="65" y1="34" x2="65" y2="114" stroke="#ffd700" strokeWidth="8" />
              <path d="M16 46 Q65 62 114 46" stroke="#ffd700" strokeWidth="8" fill="none" />
              {/* Golden Bow Center */}
              <circle cx="65" cy="54" r="8" fill="#ffd700" />
              <ellipse cx="55" cy="50" rx="9" ry="5" fill="#ffc107" transform="rotate(-25 55 50)" />
              <ellipse cx="75" cy="50" rx="9" ry="5" fill="#ffc107" transform="rotate(25 75 50)" />
            </svg>
          </div>

          {/* Right Margin: Winged Love Letter Envelope Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              top: '135px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 64px))',
              animation: 'floatStickerReverse 5.6s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="136" height="105" viewBox="0 0 150 115">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                {/* Wings */}
                <path d="M48 55 C25 35, 6 45, 12 70 C20 78, 42 70, 48 64 Z" fill="#ffffff" />
                <path d="M102 55 C125 35, 144 45, 138 70 C130 78, 108 70, 102 64 Z" fill="#ffffff" />
                {/* Envelope */}
                <rect x="42" y="38" width="66" height="46" rx="4" fill="#ffffff" />
              </g>
              {/* Wings */}
              <path d="M48 55 C25 35, 6 45, 12 70 C20 78, 42 70, 48 64 Z" fill="#fdf2f4" stroke="#fbcfe8" strokeWidth="2" />
              <path d="M102 55 C125 35, 144 45, 138 70 C130 78, 108 70, 102 64 Z" fill="#fdf2f4" stroke="#fbcfe8" strokeWidth="2" />
              {/* Envelope Body */}
              <rect x="42" y="38" width="66" height="46" rx="4" fill="#fffaf0" stroke="#fed7aa" strokeWidth="2" />
              <polygon points="42,38 75,64 108,38" fill="#fef3c7" stroke="#fed7aa" strokeWidth="2" />
              {/* Red Wax Heart Seal */}
              <path
                d="M75 70 C75 70, 68 64, 68 60 C68 57, 71 55, 73.5 56.5 C75 57.5, 75 58.5, 75 58.5 C75 58.5, 75 57.5, 76.5 56.5 C79 55, 82 57, 82 60 C82 64, 75 70, 75 70 Z"
                fill="#d90429"
              />
            </svg>
          </div>
        </>
      )}

      {/* ==================== ST. PATRICK'S STICKERS ==================== */}
      {holiday === 'stpatricks' && (
        <>
          {/* Left Margin: Pot of Gold Cauldron Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '105px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 60px))',
              animation: 'floatStickerSlow 5.3s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="124" height="122" viewBox="0 0 130 128">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                <ellipse cx="65" cy="46" rx="42" ry="14" fill="#ffffff" />
                <ellipse cx="65" cy="74" rx="45" ry="38" fill="#ffffff" />
              </g>
              {/* Cauldron Belly */}
              <ellipse cx="65" cy="74" rx="45" ry="38" fill="#1e232a" />
              {/* Rim */}
              <ellipse cx="65" cy="46" rx="44" ry="14" fill="#2d333b" />
              {/* Gold Mound */}
              <ellipse cx="65" cy="44" rx="38" ry="11" fill="#ffd700" />
              {/* Gold coins */}
              <circle cx="52" cy="42" r="6" fill="#ffc107" stroke="#ffa000" strokeWidth="1" />
              <circle cx="68" cy="40" r="6.5" fill="#ffd700" stroke="#ffa000" strokeWidth="1" />
              <circle cx="82" cy="43" r="6" fill="#ffc107" stroke="#ffa000" strokeWidth="1" />
              <circle cx="42" cy="46" r="5.5" fill="#ffd700" stroke="#ffa000" strokeWidth="1" />
              {/* Sparkles */}
              <polygon points="65,22 67,29 74,31 67,33 65,40 63,33 56,31 63,29" fill="#fff9a6" />
              <polygon points="88,26 89,30 93,31 89,32 88,36 87,32 83,31 87,30" fill="#fff9a6" />
            </svg>
          </div>

          {/* Right Margin: Lucky 4-Leaf Shamrock with Mini Rainbow Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              top: '125px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 58px))',
              animation: 'floatStickerReverse 5.7s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="128" height="128" viewBox="0 0 135 135">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round">
                {/* Rainbow Arc */}
                <path d="M25 85 C25 35, 110 35, 110 85" fill="none" stroke="#ffffff" strokeWidth="16" />
                {/* 4 Clover Leaves */}
                <circle cx="48" cy="65" r="16" fill="#ffffff" />
                <circle cx="82" cy="65" r="16" fill="#ffffff" />
                <circle cx="65" cy="48" r="16" fill="#ffffff" />
                <circle cx="65" cy="82" r="16" fill="#ffffff" />
                <path d="M65 82 Q68 112 85 118" fill="none" stroke="#ffffff" strokeWidth="8" />
              </g>
              {/* Rainbow */}
              <path d="M25 85 C25 35, 110 35, 110 85" fill="none" stroke="#ef4444" strokeWidth="3" />
              <path d="M27 85 C27 38, 108 38, 108 85" fill="none" stroke="#f59e0b" strokeWidth="3" />
              <path d="M29 85 C29 41, 106 41, 106 85" fill="none" stroke="#10b981" strokeWidth="3" />
              <path d="M31 85 C31 44, 104 44, 104 85" fill="none" stroke="#3b82f6" strokeWidth="3" />
              {/* Shamrock stem */}
              <path d="M65 82 Q68 112 85 118" fill="none" stroke="#1b4332" strokeWidth="5" strokeLinecap="round" />
              {/* Shamrock 4 leaves */}
              <circle cx="48" cy="65" r="15" fill="#007f5f" />
              <circle cx="82" cy="65" r="15" fill="#007f5f" />
              <circle cx="65" cy="48" r="15" fill="#2ec4b6" />
              <circle cx="65" cy="82" r="15" fill="#007f5f" />
              <circle cx="65" cy="65" r="7" fill="#007f5f" />
            </svg>
          </div>
        </>
      )}

      {/* ==================== THANKSGIVING STICKERS ==================== */}
      {holiday === 'thanksgiving' && (
        <>
          {/* Left Margin: Wicker Cornucopia Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '105px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 60px))',
              animation: 'floatStickerSlow 5.5s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="130" height="120" viewBox="0 0 140 128">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                <path d="M35 55 C35 25, 115 15, 125 75 C125 105, 95 115, 75 100 L35 85 Z" fill="#ffffff" />
                <ellipse cx="35" cy="70" rx="18" ry="24" fill="#ffffff" />
              </g>
              {/* Horn Body */}
              <path d="M35 55 C35 25, 115 15, 125 75 C125 105, 95 115, 75 100 L35 85 Z" fill="#99582a" />
              {/* Horn ridges */}
              <path d="M60 48 Q85 62 70 95" stroke="#7f4f24" strokeWidth="4" fill="none" />
              <path d="M85 45 Q105 65 92 88" stroke="#7f4f24" strokeWidth="4" fill="none" />
              {/* Flared Mouth */}
              <ellipse cx="35" cy="70" rx="18" ry="24" fill="#7f4f24" />
              {/* Harvest bounty spilling out */}
              <circle cx="28" cy="78" r="14" fill="#ea580c" />
              <circle cx="28" cy="78" r="10" fill="#f97316" />
              <polygon points="26,62 30,62 28,56" fill="#2d6a4f" />
              {/* Red apple */}
              <circle cx="45" cy="84" r="10" fill="#b91c1c" />
              {/* Yellow gourd */}
              <ellipse cx="44" cy="62" rx="9" ry="14" fill="#eab308" transform="rotate(25 44 62)" />
            </svg>
          </div>

          {/* Right Margin: Pumpkin Pie Slice Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '105px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 55px))',
              animation: 'floatStickerReverse 5.9s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="124" height="110" viewBox="0 0 135 120">
              {/* White backing */}
              <g stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
                <polygon points="22,78 112,38 102,96" fill="#ffffff" />
                <path d="M112 38 Q118 68 102 96" stroke="#ffffff" strokeWidth="12" fill="none" />
              </g>
              {/* Flaky Crust Back */}
              <path d="M112 38 Q118 68 102 96" stroke="#d4a373" strokeWidth="10" fill="none" strokeLinecap="round" />
              {/* Pumpkin Filling Triangle */}
              <polygon points="22,78 110,42 100,92" fill="#bc6c25" />
              <polygon points="22,78 105,72 100,92" fill="#99582a" opacity="0.4" />
              {/* Whipped cream swirl */}
              <g transform="translate(68, 66)">
                <ellipse cx="0" cy="0" rx="12" ry="8" fill="#ffffff" />
                <circle cx="-2" cy="-4" r="6" fill="#fdfbf7" />
                <circle cx="0" cy="-7" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>
        </>
      )}
      {holiday === 'newyear' && (
        <>
          {/* Left Margin: Golden Sparkler / Confetti Starburst Sticker */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              top: '135px',
              left: 'max(14px, calc((100vw - 896px) / 4 - 55px))',
              animation: 'floatStickerSlow 5.2s ease-in-out infinite',
              ...stickerWrapperStyle
            }}
          >
            <svg width="108" height="108" viewBox="0 0 120 120">
              <g stroke="#ffffff" strokeWidth="5" strokeLinejoin="round">
                <polygon
                  points="60,10 71,42 105,42 78,62 88,95 60,75 32,95 42,62 15,42 49,42"
                  fill="#ffd700"
                />
                <circle cx="96" cy="24" r="7" fill="#ff45e6" />
                <circle cx="24" cy="86" r="6" fill="#00f0ff" />
              </g>
            </svg>
          </div>

          {/* Right Margin: Flickering 2027 Neon Sign Sticker (shown on wide screens for symmetry) */}
          <div
            className="tml-margin-sticker"
            style={{
              position: 'fixed',
              bottom: '95px',
              right: 'max(14px, calc((100vw - 896px) / 4 - 68px))',
              transform: 'rotate(-6deg)',
              animation: 'neonFlicker2D 4.5s infinite',
              ...stickerWrapperStyle
            }}
          >
            <div
              style={{
                background: 'rgba(12, 14, 24, 0.88)',
                border: '3px solid #ffd700',
                borderRadius: '16px',
                padding: '10px 18px',
                boxShadow:
                  '0 0 18px rgba(255, 215, 0, 0.55), inset 0 0 12px rgba(255, 215, 0, 0.35)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 900,
                fontSize: '34px',
                letterSpacing: '3px',
                color: '#fff6cc',
                textShadow:
                  '0 0 8px #ffd700, 0 0 18px #ffae00, 0 0 32px #ff8800'
              }}
            >
              {yearText}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Floating Holiday Theme Switcher pill for testing 2D / 3D themes in dev or when a holiday override is active.
 */
export const HolidayDebugBar = () => {
  const { holiday, overrideState, setHolidayOverride } = useHoliday()

  if (!import.meta.env.DEV && holiday === null && overrideState === 'auto') {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '102px',
        left: '40px',
        zIndex: 1000000,
        display: 'flex',
        flexWrap: 'wrap',
        maxWidth: 'calc(100vw - 80px)',
        gap: '6px',
        background: 'rgba(20, 20, 20, 0.88)',
        backdropFilter: 'blur(8px)',
        padding: '6px 10px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: '12px',
        alignItems: 'center',
        color: '#fff'
      }}
    >
      <span style={{ opacity: 0.7, marginRight: '4px', fontWeight: 600 }}>Theme:</span>
      {(
        [
          { label: 'Auto', val: 'auto' },
          { label: '❄️ Winter', val: 'winter' },
          { label: '🎃 Halloween', val: 'halloween' },
          { label: '🎉 NYE', val: 'newyear' },
          { label: '🐰 Easter', val: 'easter' },
          { label: '💖 V-Day', val: 'valentines' },
          { label: '☘️ St. Pat', val: 'stpatricks' },
          { label: '🦃 Thanks', val: 'thanksgiving' },
          { label: 'Off', val: null }
        ] as { label: string; val: HolidayType | 'auto' }[]
      ).map((opt) => {
        const isSelected = overrideState === opt.val
        return (
          <button
            key={String(opt.val)}
            onClick={() => setHolidayOverride(opt.val)}
            style={{
              background: isSelected ? '#af1414' : 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: isSelected ? 700 : 500,
              transition: 'background 0.2s'
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Sleek flickering neon year badge for the header navigation bar next to the logo.
 */
export const NavNeonYearBadge = ({ isMobile = false }: { isMobile?: boolean }) => {
  const yearText = useMemo(() => getUpcomingYear(), [])

  return (
    <div
      className="tml-nav-neon-badge"
      onClick={(e) => {
        e.stopPropagation()
        window.location.hash = '#home'
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: 'rgba(12, 14, 24, 0.94)',
        border: '2px solid #ffd700',
        borderRadius: '8px',
        padding: isMobile ? '3px 8px' : '4px 10px',
        boxShadow:
          '0 0 10px rgba(255, 215, 0, 0.55), inset 0 0 6px rgba(255, 215, 0, 0.35)',
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 900,
        fontSize: isMobile ? '13px' : '15px',
        letterSpacing: '1.5px',
        color: '#fff6cc',
        textShadow:
          '0 0 6px #ffd700, 0 0 12px #ffae00, 0 0 20px #ff8800',
        animation: 'navNeonFlicker 4.5s infinite',
        userSelect: 'none',
        lineHeight: 1
      }}
    >
      <style>{`
        @media (min-width: 896px) {
          .tml-nav-neon-badge {
            display: none !important;
          }
        }
        @keyframes navNeonFlicker {
          0%, 18%, 22%, 25%, 53%, 57%, 100% {
            opacity: 1;
            filter: drop-shadow(0 0 4px #ffd700) drop-shadow(0 0 10px rgba(255, 190, 0, 0.7));
          }
          20%, 24%, 55% {
            opacity: 0.38;
            filter: drop-shadow(0 0 1px #ffd700);
          }
        }
      `}</style>
      {yearText}
    </div>
  )
}

