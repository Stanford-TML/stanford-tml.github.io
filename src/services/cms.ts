// FILE: src/services/cms.ts

const extractYouTubeId = (input: string | undefined): string | undefined => {
  if (!input) return input;
  // If it's already exactly 11 characters without URL components, it's likely just the ID
  if (input.length === 11 && !input.includes('youtube.com') && !input.includes('youtu.be')) {
      return input;
  }
  // Match standard YouTube URLs and extract the 11-character ID
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : input;
};

// Add this helper function at the top of src/services/cms.ts
const parseSafeDate = (dateStr: string | undefined): Date => {
  if (!dateStr) return new Date();
  
  let dateObj = new Date(dateStr);
  
  // If the browser fails to parse it natively (Safari parsing "December 2002")
  if (isNaN(dateObj.getTime())) {
    // Check if it looks like "Month Year" (e.g. "December 2002")
    if (/^[A-Za-z]+ \d{4}$/.test(dateStr.trim())) {
      // Inject day 1 so Safari can parse it: "December 1, 2002"
      const safeString = dateStr.trim().replace(' ', ' 1, ');
      dateObj = new Date(safeString);
    }
  }
  
  return dateObj;
};

export const fetchPublications = async () => {
  const modules = import.meta.glob('/public/content/publications/*.json', { eager: true });
  const publications = Object.values(modules).map((mod: any) => mod.default || mod);

  // 1. Sort all publications by date descending using the safe parser
  publications.sort((a, b) => {
    const timeA = parseSafeDate(a.date).getTime();
    const timeB = parseSafeDate(b.date).getTime();
    // Fallback to 0 if NaN to avoid breaking the sort completely
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  // 2. Group by year
  const grouped: { [year: string]: any[] } = {};
  
  publications.forEach(pub => {
    const dateObj = parseSafeDate(pub.date);
    
    let year = "Unknown";
    
    if (!isNaN(dateObj.getTime())) {
      year = dateObj.getFullYear().toString();
    } else {
      // Ultimate fallback: Try to regex out any 4-digit year from the corrupt string
      const match = String(pub.date).match(/\b(19|20)\d{2}\b/);
      if (match) {
        year = match[0];
      }
    }
    
    if (!grouped[year]) {
      grouped[year] =[];
    }
    grouped[year].push(pub);
  });

  // 3. Convert the grouped object into an array sorted by year descending
  return Object.entries(grouped)
    .map(([year, pubs]) => ({ year, pubs }))
    // If year is "Unknown", push it to the bottom
    .sort((a, b) => {
      if (a.year === "Unknown") return 1;
      if (b.year === "Unknown") return -1;
      return Number(b.year) - Number(a.year);
    });
}

export const fetchPeople = async () => {
  const modules = import.meta.glob('/public/content/people/*.json', { eager: true });
  const allPeople = Object.values(modules).map((mod: any) => mod.default || mod);

  // Transform the flat list of people into the categorized object your UI expects
  return {
    pi: allPeople.find(p => p.category === 'PI') || {},
    staff: allPeople.filter(p => p.category === 'Staff'),
    fellows: allPeople.filter(p => p.category === 'Fellows'),
    students: allPeople.filter(p => p.category === 'Students'),
    alumni: allPeople.filter(p => p.category === 'Alumni')
  };
}

export const fetchCourses = async () => {
  const modules = import.meta.glob('/public/content/courses/*.json', { eager: true });
  return Object.values(modules).map((mod: any) => mod.default || mod);
}

export const fetchRecruitment = async () => {
  const modules = import.meta.glob('/public/content/recruitment/*.json', { eager: true });
  const projects = Object.values(modules).map((mod: any) => mod.default || mod);
  // Sort by newest first
  return projects.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const fetchHighlights = async () => {
  const modules = import.meta.glob('/public/content/highlights/*.json', { eager: true });
  return Object.values(modules).map((mod: any) => mod.default || mod);
}

export const fetchTurntable = async () => {
  const modules = import.meta.glob('/public/content/turntable/*.json', { eager: true });
  const slots = Object.values(modules).map((mod: any) => {
    const item = mod.default || mod;
    
    // Turntable has nested highlights with a 'videoId' field
    if (item.highlights && Array.isArray(item.highlights)) {
      item.highlights = item.highlights.map((h: any) => ({
        ...h,
        videoId: extractYouTubeId(h.videoId)
      }));
    }
    
    return item;
  });
  // Sort by an 'order' field if you add one, otherwise rely on filename
  return slots.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
}

export const fetchHomeContent = async () => {
  const modules = import.meta.glob('/public/content/home.json', { eager: true });
  const mod = modules['/public/content/home.json'] as any;
  return mod ? (mod.default || mod) : null;
}

export const getHomeContentSync = () => {
  const modules = import.meta.glob('/public/content/home.json', { eager: true });
  const mod = modules['/public/content/home.json'] as any;
  return mod ? (mod.default || mod) : null;
}

export const fetchJoinContent = async () => {
  const modules = import.meta.glob('/public/content/join.json', { eager: true });
  const mod = modules['/public/content/join.json'] as any;
  return mod ? (mod.default || mod) : null;
}