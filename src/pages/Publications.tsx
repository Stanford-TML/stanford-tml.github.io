// FILE: src/pages/Publications.tsx
import { useEffect, useState } from 'react'
import { fetchPublications } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

export const Publications = () => {
  const [groupedPubs, setGroupedPubs] = useState<any[]>([])

  useEffect(() => {
    fetchPublications().then(setGroupedPubs)
  }, [])

  return (
    <div className="absolute top-0 left-0 w-full pt-32 px-6 md:px-12 lg:px-24 pb-24 min-h-screen bg-[#e0e0e0] cursor-auto z-10 pointer-events-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">Publications</h1>
          <div className="w-24 h-1 bg-[#8C1515] mx-auto rounded-full"></div>
        </div>

        {/* Grouped Publications */}
        <div className="flex flex-col gap-12">
          {groupedPubs.map((group) => (
            <div key={group.year}>

              {/* Year Separator */}
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2">
                {group.year}
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