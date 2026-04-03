// FILE: src/pages/MobileHome.tsx
import { useEffect, useState } from 'react'
import { getHomeContentSync, fetchTurntable } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

export const MobileHome = () => {
  const[turntableData, setTurntableData] = useState<any[]>([])
  
  // Fetch home content synchronously
  const homeData = getHomeContentSync() || {}
  
  // Fallbacks
  const intro = homeData.intro || { title: "The Movement Lab", subtitle: "@ Stanford" }
  const robot = homeData.robot || { name: "Dr. Karen Liu", title: "Principal Investigator", description: "Welcome to The Movement Lab website!" }
  const joinUs = homeData.joinUs || { titleLine1: "Join The", titleLine2: "Movement", description: "Help us build the next generation of intelligent movement.", button: "OPEN POSITIONS" }

  useEffect(() => {
    const loadTurntable = async () => {
      try {
        const data = await fetchTurntable()
        if (data) setTurntableData(data)
      } catch (error) {
        console.error("Failed to load turntable content for mobile", error)
      }
    }
    loadTurntable()
  },[])

  return (
    <div className="absolute top-0 left-0 w-full min-h-screen bg-[#e0e0e0] flex justify-center font-sans text-gray-900 z-0">
      
      <div className="w-full max-w-4xl bg-[#f4f4f4] shadow-2xl min-h-screen flex flex-col pb-12">
        
        {/* Header Page Title */}
        <div className="pt-28 pb-8 px-6 sm:px-10 relative z-10 flex flex-col items-start">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
            {intro.title}
          </h1>
          {/* MOVED STANFORD WORDMARK HERE */}
          <img 
            src="/assets/SUSig-red.png" 
            alt="Stanford University" 
            className="h-6 sm:h-7 object-contain" 
          />
        </div>

        {/* Billboard Section */}
        <div className="px-6 sm:px-10 pb-10 relative z-0">
          <div className="bg-[#f9f9f9] rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 border border-gray-200 flex flex-col">
            
            {/* Cover Photo */}
            <div className="w-full h-56 sm:h-[350px] bg-[#e0e0e0] relative shrink-0">
              <ProgressiveImage 
                highResSrc="assets/cover_photo_wide.jpg"
                lowResSrc="assets/cover_photo_wide_small.jpg"
                alt="The Movement Lab" 
                containerClass="w-full h-full" 
                imageClass="w-full h-full object-bottom block"
              />
            </div>

            {/* Content Area */}
            <div className="p-8 sm:p-10 flex flex-col">
              
              {/* Description Body (Wordmark removed from above this) */}
              <p className="text-[#4d4c47] leading-relaxed text-base mb-10 font-medium">
                {robot.description}
              </p>

              {/* Signature Block */}
              <div className="border-t-2 border-[#eaeaea] pt-6 flex flex-col text-right">
                <h2 className="text-xl font-bold text-[#2e2d29] mb-1">
                  - {robot.name}
                </h2>
                <p className="text-xs font-semibold text-[#8C1515] uppercase tracking-widest">
                  {robot.title}
                </p>
              </div>
              
            </div>
          </div>
        </div>

        {/* Research Areas */}
        <div className="px-6 sm:px-10 py-6">
          <h3 className="text-2xl font-extrabold mb-6 text-gray-900 tracking-tight">Research Areas</h3>
          <div className="flex flex-col gap-6">
            {turntableData.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 sm:p-8 shadow-md shadow-gray-200/40 border-l-4 border-[#8C1515] flex flex-col">
                
                {item.image && (
                  <ProgressiveImage 
                    highResSrc={item.image} 
                    alt={item.title} 
                    containerClass="w-full h-48 sm:h-64 mb-6 rounded-xl overflow-hidden shadow-sm"
                    imageClass="w-full h-full object-cover bg-gray-100" 
                  />
                )}

                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold">
                  {item.label}
                </p>
                <h4 className="text-lg font-bold mb-2 text-gray-900 leading-tight">
                  {item.title}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Join Us CTA */}
        <div className="px-6 sm:px-10 py-12 mt-6 border-t border-gray-200">
          <div className="text-center max-w-md mx-auto">
            <h3 className="text-3xl font-extrabold mb-4 tracking-tight text-gray-900">
              {joinUs.titleLine1} <span className="text-[#8C1515]">{joinUs.titleLine2}</span>
            </h3>
            <p className="text-gray-600 text-sm mb-8 leading-relaxed">
              {joinUs.description}
            </p>
            <button 
              onClick={() => window.location.hash = '#join'}
              className="bg-[#8C1515] text-white font-bold py-4 px-8 rounded-full hover:bg-red-800 transition-colors w-full shadow-lg shadow-red-900/20 tracking-wide text-sm"
            >
              {joinUs.button}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}