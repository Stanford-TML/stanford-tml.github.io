// FILE: src/pages/People.tsx
import { useEffect, useState } from 'react'
import { fetchPeople } from '../services/cms'

export const People = () => {
  const [data, setData] = useState<any>(null)
  const [isLargeImageLoaded, setIsLargeImageLoaded] = useState(false)

  useEffect(() => {
    fetchPeople().then(setData)
  },[])

  if (!data) {
    return (
      <div className="absolute top-0 left-0 w-full pt-32 px-8 min-h-screen bg-[#e0e0e0] flex justify-center items-start cursor-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <div className="flex flex-col items-center gap-4 mt-20">
          <div className="w-12 h-12 border-4 border-[#8C1515] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-semibold uppercase tracking-widest text-sm">Loading team...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 w-full min-h-screen bg-[#e0e0e0] cursor-auto flex justify-center z-10 pointer-events-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      
      {/* Center Column - Lighter subtle background, reduced width */}
      <div className="w-full max-w-6xl bg-[#f4f4f4] shadow-2xl min-h-screen flex flex-col">
        
        {/* Header Section */}
        <div className="pt-32 px-8 md:px-16 pb-12">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">Our Team</h1>
            <div className="w-24 h-1 bg-[#8C1515] mx-auto rounded-full"></div>
          </div>
        </div>

        {/* Full-width Banner */}
        <div className="w-full mb-20 relative group overflow-hidden bg-gray-200 h-[300px] md:h-[400px] lg:h-[500px]">
        
        {/* Small Placeholder Image - Loads instantly, blurred */}
        <img 
            src="assets/group_photo_small.jpg" 
            alt="The Movement Lab Group Placeholder" 
            className={`absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-500 ${
            isLargeImageLoaded ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ filter: 'blur(10px)' }}
        />

        {/* Large Main Image */}
        <img 
            src="assets/group_photo.jpg" 
            alt="The Movement Lab Group" 
            onLoad={() => setIsLargeImageLoaded(true)}
            className={`w-full h-full object-cover object-bottom transform transition-all duration-700 ease-out group-hover:scale-105 ${
            isLargeImageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
        </div>

        {/* Content Container */}
        <div className="px-8 md:px-16 pb-24">
          
          {/* PI Section - Kept as a card to highlight hierarchy */}
          <div className="bg-white rounded-xl p-8 md:p-12 shadow-md mb-24 flex flex-col md:flex-row items-center gap-12 border-t-4 border-[#8C1515]">
            <div className="relative w-56 h-56 flex-shrink-0 rounded-full overflow-hidden shadow-inner border-4 border-gray-50">
              <img 
                src={data.pi.image} 
                alt={data.pi.name} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="text-center md:text-left flex-1">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">{data.pi.name}</h2>
              <p className="text-[#8C1515] font-bold text-lg uppercase tracking-widest mb-6">{data.pi.role}</p>
              <p className="text-gray-600 leading-relaxed text-lg">{data.pi.bio}</p>
            </div>
          </div>

          {/* Reusable Grid Component for Staff, Fellows, Students */}
          {['Staff', 'Fellows', 'Students'].map((sectionKey) => {
            const items = data[sectionKey.toLowerCase()]
            if (!items || items.length === 0) return null
            
            return (
              <div key={sectionKey} className="mb-20">
                <div className="flex items-center gap-6 mb-10">
                  <h2 className="text-3xl font-bold text-gray-900 m-0">{sectionKey}</h2>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
                
                {/* Stripped the white boxes, just clean images and text */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                  {items.map((person: any) => (
                    <div key={person.id} className="group flex flex-col items-center text-center">
                      <div className="relative w-full aspect-square overflow-hidden rounded-lg mb-4 bg-gray-200 shadow-sm">
                        <img 
                          src={person.image} 
                          alt={person.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out" 
                        />
                        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{person.name}</h3>
                      <p className="text-[#8C1515] font-semibold text-xs uppercase tracking-wider">{person.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Alumni Section - Stripped the white box */}
          <div className="mb-16">
            <div className="flex items-center gap-6 mb-10">
              <h2 className="text-3xl font-bold text-gray-900 m-0">Alumni</h2>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 pl-2">
              {data.alumni.map((alumnus: string, idx: number) => (
                <div key={idx} className="flex items-center gap-3 group">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:bg-[#8C1515] transition-colors"></div>
                  <span className="text-gray-700 font-medium group-hover:text-[#8C1515] transition-colors cursor-default">
                    {alumnus}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rendered Scene Image */}
          <div className="relative w-full mt-16 mb-8">
            <img src="assets/scene_group.png" alt="Group Scene" className="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />
            
            {/* Feathering Overlays */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#f4f4f4] to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#f4f4f4] to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#f4f4f4] to-transparent pointer-events-none"></div>
          </div>

        </div>
      </div>
    </div>
  )
}
