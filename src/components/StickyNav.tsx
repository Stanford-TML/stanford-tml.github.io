// FILE: src/components/StickyNav.tsx
import { useRef, useState, useEffect } from 'react'

interface StickyNavProps {
  isVisible: boolean
}

export const StickyNav = ({ isVisible }: StickyNavProps) => {
  const navRef = useRef<HTMLElement>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  const links = ['Home', 'People', 'Publications', 'Courses', 'Join']

  // Handle window resize to toggle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false) // Auto-close menu if resized back to desktop
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  },[])

  // Prevent background scrolling when the mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isMenuOpen])

  return (
    <>
      <nav
        ref={navRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          padding: isMobile ? '15px 20px' : '15px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(240, 240, 240, 0.95)', 
          backdropFilter: 'blur(10px)',
          zIndex: 1000000,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: isVisible ? 1 : 0,
          borderBottom: '1px solid #ccc',
          pointerEvents: 'auto', 
          boxSizing: 'border-box'
        }}
      >
        {/* LOGO IMAGE */}
        <img 
          src="assets/logo.png" 
          alt="TML Logo"
          onClick={() => {
            window.location.hash = '#home'
            setIsMenuOpen(false)
          }}
          style={{
              height: '50px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              cursor: 'pointer'
          }}
        />
        
        {isMobile ? (
          /* HAMBURGER BUTTON */
          <button 
            onClick={() => setIsMenuOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px',
              zIndex: 1000002
            }}
          >
            <div style={{ width: '30px', height: '3px', background: '#555', borderRadius: '2px' }} />
            <div style={{ width: '30px', height: '3px', background: '#555', borderRadius: '2px' }} />
            <div style={{ width: '30px', height: '3px', background: '#555', borderRadius: '2px' }} />
          </button>
        ) : (
          /* DESKTOP LINKS */
          <div style={{ display: 'flex', gap: '30px' }}>
            {links.map(link => (
              <a 
                key={link} 
                href={link === 'Home' ? '#home' : `#${link.toLowerCase()}`} 
                style={{ 
                    color: '#555', 
                    textDecoration: 'none', 
                    fontSize: '0.9rem', 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontFamily: 'Montserrat, sans-serif',
                    letterSpacing: '0.5px',
                    transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#af1414'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
              >
                {link}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* MOBILE FULLSCREEN MENU OVERLAY */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(240, 240, 240, 0.98)',
          backdropFilter: 'blur(15px)',
          zIndex: 1000001,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '40px',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: isMenuOpen ? 1 : 0,
          transform: isMenuOpen ? 'translateY(0)' : 'translateY(-20px)',
          pointerEvents: isMenuOpen ? 'auto' : 'none'
        }}
      >
        {/* CLOSE BUTTON */}
        <button 
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'absolute',
            top: '25px',
            right: '25px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '3rem',
            color: '#555',
            padding: '10px',
            lineHeight: '0.5'
          }}
        >
          &times;
        </button>

        {links.map(link => (
          <a 
            key={link} 
            href={link === 'Home' ? '#home' : `#${link.toLowerCase()}`} 
            onClick={() => setIsMenuOpen(false)}
            style={{ 
                color: '#333', 
                textDecoration: 'none', 
                fontSize: '2rem', 
                fontWeight: 700,
                textTransform: 'uppercase',
                fontFamily: 'Montserrat, sans-serif',
                letterSpacing: '2px',
                transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#af1414'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#333'}
          >
            {link}
          </a>
        ))}
      </div>
    </>
  )
}