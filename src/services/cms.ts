// FILE: src/services/cms.ts
import { getCanonicalVenue } from '../utils/venue';

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
  const publications = Object.values(modules).map((mod: any) => {
    const pub = { ...(mod.default || mod) };
    const dateObj = parseSafeDate(pub.date);
    let year = "Unknown";
    
    if (!isNaN(dateObj.getTime())) {
      year = dateObj.getFullYear().toString();
    } else {
      const match = String(pub.date).match(/\b(19|20)\d{2}\b/);
      if (match) {
        year = match[0];
      }
    }

    pub.year = year;
    pub.dateTimestamp = isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
    pub.canonicalVenue = getCanonicalVenue(pub.venue);
    return pub;
  });

  // Default sort by date descending
  publications.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

  return publications;
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