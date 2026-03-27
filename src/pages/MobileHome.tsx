// FILE: src/pages/MobileHome.tsx
import { useEffect, useState } from 'react'
import { getHomeContentSync, fetchTurntable } from '../services/cms'

export const MobileHome = () => {
  const [turntableData, setTurntableData] = useState<any[]>([])
  
  // Fetch home content synchronously (since it's eager loaded)
  const homeData = getHomeContentSync() || {}
  
  // Fallbacks in case CMS data is missing or still populating
  const intro = homeData.intro || { title: "The Movement Lab", subtitle: "@ Stanford" }
  const robot = homeData.robot || { name: "Dr. Karen Liu", title: "Principal Investigator", description: "Welcome to The Movement Lab website!" }
  const joinUs = homeData.joinUs || { titleLine1: "Join The", titleLine2: "Movement", description: "Help us build the next generation of intelligent movement.", button: "OPEN POSITIONS" }

  // Fetch turntable (research areas) asynchronously
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
      
      {/* Hero Section */}
      <div className="pt-28 pb-10 px-6 bg-white shadow-sm rounded-b-3xl relative z-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
          {intro.title}
        </h1>
        <h2 className="text-xl font-medium text-[#8C1515] tracking-wide">
          {intro.subtitle}
        </h2>
      </div>

      {/* PI / Blurb Section */}
      <div className="px-6 py-10 -mt-4 relative z-0">
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center">
          <img 
            src="/assets/karen.jpg" 
            alt={robot.name} 
            className="w-36 h-36 rounded-full object-cover mb-5 shadow-md border-4 border-white" 
          />
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{robot.name}</h3>
          <p className="text-xs font-bold text-[#8C1515] uppercase tracking-widest mb-6">
            {robot.title}
          </p>
          <p className="text-gray-600 leading-relaxed text-left text-sm">
            {robot.description}
          </p>
        </div>
      </div>

      {/* Research Areas */}
      <div className="px-6 py-6">
        <h3 className="text-2xl font-extrabold mb-6 text-gray-900 tracking-tight">Research Areas</h3>
        <div className="flex flex-col gap-6">
          {turntableData.map((item, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-md shadow-gray-200/40 border-l-4 border-[#8C1515] flex flex-col">
              
              {/* Static Image Placeholder for CMS */}
              {item.image && (
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-48 object-cover rounded-xl mb-5 bg-gray-100"
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
      <div className="px-6 py-12 mt-6 border-t border-gray-200">
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
  )
}