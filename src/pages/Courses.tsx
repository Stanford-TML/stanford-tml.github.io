// FILE: src/pages/Courses.tsx
import { useEffect, useState } from 'react'
import { fetchCourses } from '../services/cms'
import { ProgressiveImage } from '../components/ProgressiveImage'

export const Courses = () => {
    const [courses, setCourses] = useState<any[] | null>(null)

    useEffect(() => {
        fetchCourses().then(setCourses)
    }, [])

    if (!courses) {
        return (
            <div className="absolute top-0 left-0 w-full pt-32 px-8 min-h-screen bg-[#e0e0e0] flex justify-center items-start z-10">
                <div className="flex flex-col items-center gap-4 mt-20">
                    <div className="w-12 h-12 border-4 border-gray-300 border-t-[#8C1515] rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-semibold uppercase tracking-widest text-sm animate-pulse">Loading Courses...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute top-0 left-0 w-full pt-32 px-6 md:px-12 lg:px-24 pb-24 min-h-screen bg-[#e0e0e0] cursor-auto z-10 pointer-events-auto" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <div className="max-w-6xl mx-auto">

                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">Courses</h1>
                    <div className="w-24 h-1 bg-[#8C1515] mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
                    {courses.map((course, idx) => (
                        <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col">
                            <div className="h-48 w-full overflow-hidden bg-gray-100">
                                <ProgressiveImage highResSrc={course.image || 'https://via.placeholder.com/600x400?text=Course+Image'} alt={course.title} imageClass="w-full h-full object-cover" />
                            </div>
                            <div className="p-8 flex flex-col flex-grow">
                                <h3 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
                                    <span className="text-[#8C1515] block text-sm uppercase tracking-wider mb-1">{course.code}</span>
                                    {course.title}
                                </h3>
                                <p className="text-gray-600 mb-8 flex-grow leading-relaxed">
                                    {course.description}
                                </p>
                                {/* Conditional Footer: Active Link vs Inactive Badge */}
                                {course.active !== false ? (
                                    <a
                                        href={course.link || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-block bg-[#8C1515] !text-white font-bold py-3 px-6 rounded-lg hover:bg-red-800 transition-colors w-fit shadow-md"
                                    >
                                        Read More ↗
                                    </a>
                                ) : (
                                    <div className="inline-block bg-gray-100 text-gray-500 font-bold py-3 px-6 rounded-lg w-fit border border-gray-200 cursor-not-allowed">
                                        Last offered {course.last_offered || 'in the past'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
            {/* Rendered Scene Image */}
            <div className="relative w-full mt-24 mb-8">
                <ProgressiveImage highResSrc="/assets/scene_lecture.png" lowResSrc="/assets/scene_lecture_small.png" alt="Lecture Scene" imageClass="w-full object-contain opacity-90 hover:opacity-100 transition-opacity duration-500" />

                {/* Feathering Overlays */}
                <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#e0e0e0] to-transparent pointer-events-none"></div>
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#e0e0e0] to-transparent pointer-events-none"></div>
                <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#e0e0e0] to-transparent pointer-events-none"></div>
            </div>
        </div>


    )
}