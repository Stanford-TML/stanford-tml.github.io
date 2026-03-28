// FILE: src/pages/NotFound.tsx
import { ProgressiveImage } from '../components/ProgressiveImage'

export const NotFound = () => {
  return (
    <div className="absolute top-0 left-0 w-screen min-h-screen bg-[#ddd] flex flex-col items-center justify-center px-6 font-sans text-center overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
    {/* Rendered Scene Image */}
    {/* Change 'w-1/3' to 'w-full md:w-1/3' */}
    <div className="relative w-full md:w-1/3 mt-24 mb-8">
        <ProgressiveImage highResSrc="/assets/404.png" lowResSrc="/assets/404_small.png" alt="404 Error" imageClass="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />

        {/* Feathering Overlays */}
        <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#ddd] to-transparent pointer-events-none"></div>
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#ddd] to-transparent pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#ddd] to-transparent pointer-events-none"></div>
    </div>
      {/* 404 Graphic Container */}
      <div className="relative flex justify-center items-center mb-2 md:mb-6">
        <h1 className="text-8xl md:text-9xl lg:text-[12rem] font-extrabold text-gray-600 tracking-widest select-none">
          404
        </h1>
        <div className="bg-[#8C1515] text-white px-3 py-1 text-sm md:text-base font-bold rounded rotate-12 absolute shadow-md transform -translate-y-2 md:-translate-y-6">
          Page Not Found
        </div>
      </div>
      
      {/* Text & CTA Container */}
      <div className="relative z-10 px-4">
        <h3 className="text-2xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
          Lost in the simulation?
        </h3>
        <p className="text-gray-600 mb-8 max-w-sm md:max-w-md mx-auto leading-relaxed text-sm md:text-base">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        
        <button 
          onClick={() => window.location.hash = '#home'}
          className="bg-[#8C1515] text-white font-bold py-3 px-8 md:py-4 md:px-10 rounded-full hover:bg-red-800 transition-colors shadow-lg shadow-red-900/20 tracking-wide text-sm md:text-base"
        >
          RETURN TO BASE
        </button>
      </div>
      
    </div>
  )
}