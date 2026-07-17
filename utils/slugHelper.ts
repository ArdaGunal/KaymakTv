export const generateSlug = (text: string): string => {
  if (!text) return 'unknown';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const generateMediaSlug = (traktId: number, traktSlug?: string, title?: string): string => {
  const slug = traktSlug || generateSlug(title || '');
  return `${traktId}-${slug}`;
};

export const generateEpisodeSlug = (showTraktId: number, showSlug: string | undefined, showTitle: string | undefined, season: number, episode: number, epTraktId: number): string => {
  const finalShowSlug = showSlug || generateSlug(showTitle || '');
  return `${showTraktId}-${finalShowSlug}-s${season}e${episode}-${epTraktId}`;
};

export const parseMediaSlug = (slugStr: string): { traktId: number, slugText: string } => {
  if (!slugStr) return { traktId: 0, slugText: '' };
  
  const parts = slugStr.split('-');
  const traktId = parseInt(parts[0], 10);
  
  return { 
    traktId: isNaN(traktId) ? 0 : traktId,
    slugText: parts.slice(1).join('-')
  };
};

export const parseEpisodeSlug = (slugStr: string): { showTraktId: number, showSlug: string, season: number, episode: number, epTraktId: number } => {
  if (!slugStr) return { showTraktId: 0, showSlug: '', season: 1, episode: 1, epTraktId: 0 };
  
  const parts = slugStr.split('-');
  
  const showTraktId = parseInt(parts[0], 10);
  const epTraktId = parseInt(parts[parts.length - 1], 10);
  
  const sePart = parts[parts.length - 2] || '';
  let season = 1;
  let episode = 1;
  
  const sMatch = sePart.match(/s(\d+)e(\d+)/i);
  if (sMatch) {
    season = parseInt(sMatch[1], 10);
    episode = parseInt(sMatch[2], 10);
  }

  const showSlug = parts.slice(1, parts.length - 2).join('-');

  return {
    showTraktId: isNaN(showTraktId) ? 0 : showTraktId,
    showSlug,
    season,
    episode,
    epTraktId: isNaN(epTraktId) ? 0 : epTraktId
  };
};

export const formatSlugToTitle = (slug: string): string => {
  if (!slug) return '';
  return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};
