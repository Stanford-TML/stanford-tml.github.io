// FILE: src/pages/Join.tsx
import { useEffect, useState } from 'react'
import { fetchRecruitment, fetchHighlights, fetchJoinContent } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

export const Join = () => {
    const [projects, setProjects] = useState<any[] | null>(null)
    const[highlights, setHighlights] = useState<any[] | null>(null)
    const [joinContent, setJoinContent] = useState<any | null>(null)

    useEffect(() => {
        Promise.all([
            fetchRecruitment(), 
            fetchHighlights(),
            fetchJoinContent()
        ]).then(([projData, highData, joinData]) => {
            setProjects(projData)
            setHighlights(highData)
            setJoinContent(joinData)
        })
    },[])

    if (!projects || !highlights || !joinContent) {
        return (
            <div className="absolute top-0 left-0 w-full pt-32 px-8 min-h-screen bg-[#e0e0e0] flex justify-center items-start z-10">
                <div className="flex flex-col items-center gap-4 mt-20">
                    <div className="w-12 h-12 border-4 border-gray-300 border-t-[#8C1515] rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-semibold uppercase tracking-widest text-sm animate-pulse">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute top-0 left-0 w-full pt-32 pb-24 min-h-screen bg-[#e0e0e0] cursor-auto z-10 pointer-events-auto overflow-x-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>

            <div className="text-center mb-12 px-6">
                <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">{joinContent.title}</h1>
                <div className="w-24 h-1 bg-[#8C1515] mx-auto rounded-full"></div>
            </div>

            {/* Auto-Scrolling Highlights Gallery */}
            {highlights.length > 0 && (() => {
                // 1. Cap to 8 items max. Native video is much lighter, 
                // but we still want to avoid rendering 50 videos at once.
                const safeHighlights = highlights.slice(0, 8);
                
                // 2. Ensure we have enough items to stretch across a 4K screen. 
                const minItemsForScreen = 10;
                const repeatCount = Math.ceil(minItemsForScreen / safeHighlights.length);
                const baseHighlights = Array(repeatCount).fill(safeHighlights).flat();
                
                // 3. Duplicate exactly once for the seamless 50% loop
                const displayHighlights = [...baseHighlights, ...baseHighlights];

                return (
                    <div className="w-full overflow-hidden mb-16 relative bg-gray-900 py-8 shadow-inner">
                        <style>{`
                @keyframes scroll {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); } 
                }
                .animate-scroll {
                  display: flex;
                  width: max-content;
                  animation: scroll ${baseHighlights.length * 10}s linear infinite;
                }
                .animate-scroll:hover {
                  animation-play-state: paused;
                }
                
                /* PERFORMANCE FIX: Hardware acceleration and off-screen hiding */
                .highlight-card {
                  content-visibility: auto;
                  contain-intrinsic-size: 384px 256px;
                  transform: translateZ(0); /* Forces GPU acceleration */
                }
                
                .highlight-card .highlight-overlay {
                  background-color: transparent;
                  transition: background-color 0.3s ease;
                }
                .highlight-card:hover .highlight-overlay {
                  background-color: rgba(0, 0, 0, 0.7);
                }
                
                .highlight-card .highlight-title {
                  opacity: 0;
                  transform: translateY(1rem) scale(0.95);
                  transition: all 0.3s ease;
                }
                .highlight-card:hover .highlight-title {
                  opacity: 1;
                  transform: translateY(0) scale(1.05);
                }
              `}</style>

                        <div className="animate-scroll">
                            {displayHighlights.map((item, idx) => {
                                let mediaSrc = item.media || '';
                                if (mediaSrc && !mediaSrc.startsWith('http')) {
                                    mediaSrc = mediaSrc.replace(/^(\/?public\/)/, '/');
                                    if (!mediaSrc.startsWith('/')) mediaSrc = '/' + mediaSrc;
                                }
                                const isVideo = mediaSrc.match(/\.(mp4|webm|ogg|mov)$/i);

                                return (
                                    <a
                                        key={idx}
                                        href={item.link || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="highlight-card relative block h-64 w-96 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border-2 border-gray-700 transition-colors duration-300 hover:border-[#8C1515] bg-gray-800 mr-6"
                                    >
                                        {isVideo ? (
                                            /* Highly Optimized Native Video */
                                            <video
                                                src={mediaSrc}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                disablePictureInPicture
                                                disableRemotePlayback
                                                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            /* Uploaded Image */
                                            <ProgressiveImage
                                                highResSrc={mediaSrc}
                                                alt={item.title}
                                                imageClass="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 hover:scale-105 transition-transform duration-500"
                                            />
                                        )}

                                        <div className="highlight-overlay absolute inset-0 z-10 flex items-center justify-center p-6">
                                            <h3 className="highlight-title text-white text-2xl font-bold text-center drop-shadow-lg">
                                                {item.title}
                                            </h3>
                                        </div>
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

            <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-0">

                {/* Intro Text */}
                <div className="bg-white rounded-2xl p-8 md:p-12 shadow-md mb-16 text-lg text-gray-700 leading-relaxed">
                    <p className="mb-6 font-semibold text-gray-900">{joinContent.introText}</p>
                    <ul className="list-disc pl-6 space-y-3 mb-8 marker:text-[#8C1515]">
                        {joinContent.researchTopics?.map((topic: string, idx: number) => (
                            <li key={idx}>{topic}</li>
                        ))}
                    </ul>
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <p className="mb-4">
                            {joinContent.applicationForm?.text.split('research application form')[0]}
                            <a href={joinContent.applicationForm?.link} target="_blank" rel="noreferrer" className="text-[#8C1515] hover:underline">
                                research application form
                            </a>
                            {joinContent.applicationForm?.text.split('research application form')[1]}
                        </p>
                        <p className="text-sm text-gray-500">{joinContent.applicationForm?.disclaimer}</p>
                    </div>
                </div>

                {/* Current Projects */}
                <h2 className="text-3xl font-bold text-gray-900 mb-8 border-b-2 border-gray-300 pb-2">{joinContent.projectsHeading}</h2>

                <div className="flex flex-col gap-6 mb-16">
                    {projects.map((project, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-8 shadow-md border-l-4 border-[#8C1515]">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{project.title}</h3>
                            <div className="flex flex-wrap gap-4 text-sm font-bold text-gray-500 mb-6">
                                <span className="bg-gray-100 px-3 py-1 rounded-md">Posted: {project.date}</span>
                                <span className="bg-red-50 text-[#8C1515] px-3 py-1 rounded-md">Contact: {project.contact}</span>
                            </div>
                            <p className="text-gray-700 mb-6 leading-relaxed">{project.description}</p>
                            {project.link && (
                                <a href={project.link} target="_blank" rel="noreferrer" className="inline-block bg-[#8C1515] !text-white font-bold py-2 px-6 rounded hover:bg-red-800 transition-colors">
                                    Apply for this project
                                </a>
                            )}
                        </div>
                    ))}

                    {projects.length === 0 && (
                        <p className="text-gray-500 italic bg-white p-8 rounded-2xl shadow-sm text-center">{joinContent.noProjectsMessage}</p>
                    )}
                </div>

                {/* Footer Note */}
                <div className="bg-gray-900 text-gray-300 rounded-2xl p-8 md:p-10 shadow-xl text-sm leading-relaxed">
                    <p dangerouslySetInnerHTML={{ __html: joinContent.footerNote.replace(
                        '"Specify any project you are interested in working on."', 
                        '<span class="text-white font-semibold">"Specify any project you are interested in working on."</span>'
                    ).replace(
                        'research application form',
                        `<a href="${joinContent.applicationForm?.link}" class="text-[#ff4545] font-bold hover:underline">research application form</a>`
                    )}} />
                </div>

            </div>
            {/* Rendered Scene Image */}
            <div className="relative w-full mt-24 mb-8">
            <ProgressiveImage highResSrc="/assets/scene_run.png" lowResSrc="/assets/scene_run_small.png" alt="A rendered scene" imageClass="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />
            
            {/* Feathering Overlays */}
            <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#e0e0e0] to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#e0e0e0] to-transparent pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#e0e0e0] to-transparent pointer-events-none"></div>
            </div>
        </div>
    )
}