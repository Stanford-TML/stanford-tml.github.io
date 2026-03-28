// FILE: src/components/GlobalBackToTop.tsx
import { useState, useEffect } from 'react'

export const GlobalBackToTop = () => {
  const[isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 800) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  },[])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '40px',
        right: '40px',
        padding: '15px',
        fontSize: '20px',
        background: '#af1414',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        zIndex: 1000000,
        width: '180px',
        height: '50px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'background 0.3s, transform 0.3s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#e31b1b'
        e.currentTarget.style.transform = 'scale(1.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#af1414'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      Back to Top ↑
    </button>
  )
}