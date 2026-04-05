// FILE: src/pages/People.tsx
import { useEffect, useState, Fragment } from 'react'
import { fetchPeople } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

export const People = () => {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetchPeople().then(setData)
  }, [])

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
        <ProgressiveImage
          highResSrc="assets/group_photo.jpg"
          alt="The Movement Lab Group"
          containerClass="w-full mb-20 group bg-gray-200 h-[300px] md:h-[400px] lg:h-[500px]"
          imageClass="object-bottom transform transition-all duration-700 ease-out group-hover:scale-105"
        />

        {/* Content Container */}
        <div className="px-8 md:px-16 pb-24">

          {/* PI Section - Kept as a card to highlight hierarchy */}
          <div className="bg-white rounded-xl p-8 md:p-12 shadow-md mb-24 flex flex-col md:flex-row items-center gap-12 border-t-4 border-[#8C1515]">
            <div className="relative w-56 h-56 flex-shrink-0 rounded-full overflow-hidden shadow-inner border-4 border-gray-50">
              <ProgressiveImage highResSrc={data.pi.image} alt={data.pi.name} imageClass="w-full h-full object-cover" />
            </div>
            <div className="text-center md:text-left flex-1">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">{data.pi.name}</h2>
              <p className="text-[#8C1515] font-bold text-lg uppercase tracking-widest mb-6">{data.pi.role}</p>
              <p className="text-gray-600 leading-relaxed text-lg">{data.pi.bio}</p>
            </div>
          </div>

                    {/* Reusable Grid Component for Staff, Fellows, Students */}
          {['Staff', 'Fellows', 'Students'].map((sectionKey) => {
            let items = data[sectionKey.toLowerCase()]
            if (!items || items.length === 0) return null

            // Helper to determine hierarchy level
            const getRank = (role: string) => {
              const r = (role || '').toLowerCase();
              if (r.includes('postdoc')) return 1;
              if (r.includes('phd')) return 2;
              return 3;
            };

            // Sort the Students section
            if (sectionKey === 'Students') {
              items = [...items].sort((a: any, b: any) => {
                const rankDiff = getRank(a.role) - getRank(b.role);
                if (rankDiff !== 0) return rankDiff;
                return (a.name || '').localeCompare(b.name || '');
              });
            }

            return (
              <div key={sectionKey} className="mb-20">
                <div className="flex items-center gap-6 mb-10">
                  <h2 className="text-3xl font-bold text-gray-900 m-0">{sectionKey}</h2>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
                  {items.map((person: any, idx: number) => {
                    const Wrapper = person.website ? 'a' : 'div' as any;
                    
                    // Determine if we crossed a rank boundary (e.g. from Postdoc to PhD)
                    let showDivider = false;
                    if (sectionKey === 'Students' && idx > 0) {
                      const currentRank = getRank(person.role);
                      const previousRank = getRank(items[idx - 1].role);
                      if (currentRank !== previousRank) showDivider = true;
                    }
                    
                    return (
                      // We use Fragment so the divider and the person are siblings in the CSS Grid
                      <Fragment key={person.id || person.name}>
                        
                        {/* THE DIVIDER */}
                        {showDivider && (
                          <div className="col-span-2 md:col-span-3 lg:col-span-4 flex justify-center py-4 my-2">
                            <div className="w-1/2 h-px bg-gradient-to-r from-transparent via-gray-400/60 to-transparent"></div>
                          </div>
                        )}

                        <div className="group flex flex-col items-center text-center">
                          <Wrapper 
                            href={person.website || undefined}
                            target={person.website ? "_blank" : undefined}
                            rel={person.website ? "noopener noreferrer" : undefined}
                            className={`relative w-full aspect-square overflow-hidden rounded-lg mb-4 bg-gray-200 shadow-sm flex items-center justify-center text-gray-400 ${person.website ? 'cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-[#8C1515] hover:ring-offset-2 transition-all duration-300' : ''}`}
                          >
                            {person.image ? (
                               <ProgressiveImage highResSrc={person.image} alt={person.name} imageClass="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out" />
                            ) : (
                               <svg className="w-16 h-16 opacity-30 group-hover:scale-110 transition-transform duration-500 ease-out" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            )}
                            <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${person.website ? 'opacity-0 group-hover:opacity-20' : 'opacity-0 group-hover:opacity-10'}`}></div>
                          </Wrapper>

                          <h3 className="text-lg font-bold text-gray-900 mb-1">{person.name}</h3>
                          <p className="text-[#8C1515] font-semibold text-xs uppercase tracking-wider">
                            {person.role}
                            
                            {person.coadvisor && (
                              <span className="block mt-1 text-gray-500 text-[10px] font-medium tracking-normal normal-case">
                                Co-advised with {person.coadvisor}
                              </span>
                            )}

                            {person.mentor && (
                              <span className="block mt-1 text-gray-500 text-[10px] font-medium tracking-normal normal-case">
                                Mentored by {person.mentor}
                              </span>
                            )}
                          </p>
                        </div>
                      </Fragment>
                    )
                  })}
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
              {data.alumni.map((alumnus: any, idx: number) => {
                // Standardize the role string
                let role = alumnus.title || alumnus.role || '';
                const r = role.toLowerCase();
                if (r.includes('phd') || r.includes('ph.d')) role = 'PhD';
                else if (r.includes('postdoc')) role = 'Postdoc';
                else if (r.includes('master') || r.includes('ms')) role = 'MS';
                else if (r.includes('undergrad') || r.includes('bs') || r.includes('b.s')) role = 'BS';
                else if (r.includes('research scientist')) role = 'Research Scientist';

                return (
                  <div key={idx} className="flex items-center gap-3 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 group-hover:bg-[#8C1515] transition-colors"></div>
                    <span className="text-gray-700 font-medium group-hover:text-[#8C1515] transition-colors cursor-default">
                      {alumnus.name} {role && <span className="text-gray-400 text-sm ml-1">({role})</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rendered Scene Image */}
          <div className="relative w-full mt-16 mb-8">
            <ProgressiveImage highResSrc="assets/scene_group.png" alt="Group Scene" imageClass="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />

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
