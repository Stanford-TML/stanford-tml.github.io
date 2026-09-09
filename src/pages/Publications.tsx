// FILE: src/pages/Publications.tsx
import { useEffect, useState, useMemo } from 'react'
import { fetchPublications } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

type SortOrder = 'desc' | 'asc'

export const Publications = () => {
  const [publications, setPublications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isGroupYear, setIsGroupYear] = useState<boolean>(true)
  const [isGroupVenue, setIsGroupVenue] = useState<boolean>(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    fetchPublications()
      .then((data) => {
        setPublications(data)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const displayGroups = useMemo(() => {
    if (!publications.length) return []

    const isDesc = sortOrder === 'desc'

    if (isGroupYear && !isGroupVenue) {
      const yearMap: { [year: string]: any[] } = {}
      publications.forEach((pub) => {
        const y = pub.year || 'Unknown'
        if (!yearMap[y]) yearMap[y] = []
        yearMap[y].push(pub)
      })

      const sortedYears = Object.keys(yearMap).sort((a, b) => {
        if (a === 'Unknown') return 1
        if (b === 'Unknown') return -1
        return isDesc ? Number(b) - Number(a) : Number(a) - Number(b)
      })

      return sortedYears.map((yr) => {
        const pubs = [...yearMap[yr]]
        pubs.sort((a, b) => (isDesc ? b.dateTimestamp - a.dateTimestamp : a.dateTimestamp - b.dateTimestamp))
        return { title: yr, pubs }
      })
    } else if (!isGroupYear && isGroupVenue) {
      const venueMap: { [v: string]: any[] } = {}
      publications.forEach((pub) => {
        const v = pub.canonicalVenue || 'Other / Unspecified'
        if (!venueMap[v]) venueMap[v] = []
        venueMap[v].push(pub)
      })

      const sortedVenues = Object.keys(venueMap).sort((a, b) => {
        if (a === 'Other / Unspecified') return 1
        if (b === 'Other / Unspecified') return -1
        return a.localeCompare(b)
      })

      return sortedVenues.map((vTitle) => {
        const pubs = [...venueMap[vTitle]]
        pubs.sort((a, b) => (isDesc ? b.dateTimestamp - a.dateTimestamp : a.dateTimestamp - b.dateTimestamp))
        return {
          title: `${vTitle} (${pubs.length})`,
          pubs,
        }
      })
    } else if (isGroupYear && isGroupVenue) {
      const yearMap: { [year: string]: any[] } = {}
      publications.forEach((pub) => {
        const y = pub.year || 'Unknown'
        if (!yearMap[y]) yearMap[y] = []
        yearMap[y].push(pub)
      })

      const sortedYears = Object.keys(yearMap).sort((a, b) => {
        if (a === 'Unknown') return 1
        if (b === 'Unknown') return -1
        return isDesc ? Number(b) - Number(a) : Number(a) - Number(b)
      })

      return sortedYears.map((yr) => {
        const pubs = [...yearMap[yr]]
        pubs.sort((a, b) => {
          const vA = a.canonicalVenue || ''
          const vB = b.canonicalVenue || ''
          const comp = vA.localeCompare(vB)
          if (comp !== 0) return comp
          return isDesc ? b.dateTimestamp - a.dateTimestamp : a.dateTimestamp - b.dateTimestamp
        })
        return { title: yr, pubs }
      })
    } else {
      const pubs = [...publications].sort((a, b) =>
        isDesc ? b.dateTimestamp - a.dateTimestamp : a.dateTimestamp - b.dateTimestamp
      )

      const validYears = publications
        .map((p) => p.year)
        .filter((y) => y && y !== 'Unknown' && /^\d{4}$/.test(y))
        .map(Number)

      let title = 'All Publications'
      if (validYears.length > 0) {
        const minYear = Math.min(...validYears)
        const maxYear = Math.max(...validYears)
        title = minYear === maxYear ? `${minYear}` : isDesc ? `${maxYear}–${minYear}` : `${minYear}–${maxYear}`
      }

      return [{ title, pubs }]
    }
  }, [publications, isGroupYear, isGroupVenue, sortOrder])

  if (isLoading) {
    return (
      <div className="absolute top-0 left-0 w-full pt-32 px-8 min-h-screen bg-[#e0e0e0] flex justify-center items-start cursor-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex flex-col items-center gap-4 mt-20">
          <div className="w-12 h-12 border-4 border-[#8C1515] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-semibold uppercase tracking-widest text-sm">Loading publications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 w-full pt-32 px-6 md:px-12 lg:px-24 pb-24 min-h-screen bg-[#e0e0e0] cursor-auto z-10 pointer-events-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">Publications</h1>
          <div className="w-24 h-1 bg-[#8C1515] mx-auto rounded-full"></div>
        </div>

        {/* Grouping & Chronological Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 pb-4 border-b border-gray-300">
          
          {/* Left: Group By Multi-Select Selector */}
          <div className="flex items-center gap-4">
            <span className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Group by:
            </span>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setIsGroupYear(!isGroupYear)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isGroupYear ? '3px solid #8C1515' : '3px solid transparent',
                  borderRadius: 0,
                  outline: 'none',
                  paddingBottom: '4px',
                }}
                className={`!p-0 text-sm md:text-base transition-all duration-200 cursor-pointer ${
                  isGroupYear
                    ? 'font-bold text-gray-900'
                    : 'font-medium text-gray-500 hover:text-gray-800'
                }`}
              >
                Year
              </button>

              <button
                type="button"
                onClick={() => setIsGroupVenue(!isGroupVenue)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isGroupVenue ? '3px solid #8C1515' : '3px solid transparent',
                  borderRadius: 0,
                  outline: 'none',
                  paddingBottom: '4px',
                }}
                className={`!p-0 text-sm md:text-base transition-all duration-200 cursor-pointer ${
                  isGroupVenue
                    ? 'font-bold text-gray-900'
                    : 'font-medium text-gray-500 hover:text-gray-800'
                }`}
              >
                Venue
              </button>
            </div>
          </div>

          {/* Right: Chronological Order Selector */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: sortOrder === 'desc' ? '3px solid #8C1515' : '3px solid transparent',
                borderRadius: 0,
                outline: 'none',
                paddingBottom: '4px',
              }}
              className={`!p-0 text-sm md:text-base transition-all duration-200 cursor-pointer ${
                sortOrder === 'desc'
                  ? 'font-bold text-gray-900'
                  : 'font-medium text-gray-500 hover:text-gray-800'
              }`}
            >
              Newest First
            </button>

            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: sortOrder === 'asc' ? '3px solid #8C1515' : '3px solid transparent',
                borderRadius: 0,
                outline: 'none',
                paddingBottom: '4px',
              }}
              className={`!p-0 text-sm md:text-base transition-all duration-200 cursor-pointer ${
                sortOrder === 'asc'
                  ? 'font-bold text-gray-900'
                  : 'font-medium text-gray-500 hover:text-gray-800'
              }`}
            >
              Oldest First
            </button>
          </div>

        </div>

        {/* Grouped Publications */}
        <div className="flex flex-col gap-12">
          {displayGroups.map((group) => (
            <div key={group.title}>

              {/* Group Title Separator */}
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2">
                {group.title}
              </h2>

              <div className="flex flex-col gap-6">
                {group.pubs.map((pub: any, idx: number) => {

                  return (
                    <div key={idx} className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-[#8C1515] transform hover:-translate-y-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">{pub.title}</h3>
                      <p className="text-gray-600 mb-4 text-lg">{pub.authors}</p>

                      {/* Optional Award Tag */}
                      {pub.award && (
                        <div className="flex items-center gap-2 mb-4 text-yellow-600 font-bold text-sm bg-yellow-50 w-fit px-3 py-1.5 rounded-md border border-yellow-100">
                          <span>⭐</span> {pub.award}
                        </div>
                      )}

                      <div className="flex flex-wrap justify-between items-center mt-6 pt-4 border-t border-gray-100 gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Renders pub.venue */}
                          {pub.venue && (
                            <span className="text-sm font-bold text-[#8C1515] bg-red-50 px-4 py-1.5 rounded-full border border-red-100 uppercase tracking-wider">
                              {pub.venue}
                            </span>
                          )}
                        </div>

                        {pub.link && (
                          <a href={pub.link} target="_blank" rel="noreferrer" className="text-[#8C1515] hover:text-red-800 font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-colors">
                            Read More <span className="text-lg">→</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Rendered Scene Image */}
        <div className="relative w-full mt-24 mb-8">
          <ProgressiveImage highResSrc="/assets/splash.png" alt="Pool Scene" imageClass="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />

          {/* Feathering Overlays */}
          <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#e0e0e0] to-transparent pointer-events-none"></div>
          <div className="absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-[#e0e0e0] to-transparent pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-[#e0e0e0] to-transparent pointer-events-none"></div>
        </div>

      </div>
    </div>
  )
}