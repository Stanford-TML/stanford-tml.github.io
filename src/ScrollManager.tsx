// A centralized config for all scroll-based timing
// Change values here, and they ripple through the whole app.

export const SECTIONS = {
  intro: 1,
  robot: 10,
  turntable: 20,
  joinUs: 5
}

export type SectionName = keyof typeof SECTIONS

// The order matters for calculating start/end positions
export const SECTION_ORDER: SectionName[] = [
  'intro', 
  'robot', 
  'turntable', 
  'joinUs'
]

export const getTotalPages = () => {
  return Object.values(SECTIONS).reduce((acc, val) => acc + val, 0)
}

/**
 * Returns the page offsets for a specific section.
 * @param name The name of the section (e.g., 'turntable')
 * @returns { 
 *   duration: number (pages), 
 *   startPage: number (cumulative), 
 *   endPage: number (cumulative),
 *   viewportHeight: helper function to get pixel values
 * }
 */
export const getSectionOffsets = (name: SectionName) => {
  let startPage = 0
  
  for (const section of SECTION_ORDER) {
    if (section === name) break
    startPage += SECTIONS[section]
  }

  const duration = SECTIONS[name]
  
  return {
    duration,
    startPage,
    endPage: startPage + duration,
    // Helper to get pixel values based on the current viewport height
    toPixels: (vh: number) => ({
      start: startPage * vh,
      end: (startPage + duration) * vh,
      duration: duration * vh
    })
  }
}