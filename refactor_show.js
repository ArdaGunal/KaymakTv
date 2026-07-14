const fs = require('fs');

const lines = fs.readFileSync('app/show/[id].backup.tsx', 'utf8').split(/\r?\n/);
let out = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes(`import AsyncStorage from '@react-native-async-storage/async-storage';`)) continue;
  if (line.includes(`import { getShowSummary, getShowSeasons, getShowCast, getRelatedShows, addRating, removeRating, getMediaComments }`)) {
    out.push(`import { addRating, removeRating } from '../../services/traktApi';\nimport { useShowDetail } from '../../hooks/useShowDetail';`);
    continue;
  }
  
  if (line.includes('const [isLoading, setIsLoading] = useState(true);') ||
      line.includes('const [showData, setShowData] = useState<any>(null);') ||
      line.includes('const [seasonsData, setSeasonsData] = useState<any[]>([]);') ||
      line.includes('const [castData, setCastData] = useState<any[]>([]);') ||
      line.includes('const [relatedShows, setRelatedShows] = useState<any[]>([]);') ||
      line.includes('const [commentsData, setCommentsData] = useState<any[]>([]);') ||
      line.includes('const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);') ||
      line.includes('const traktIdNum = parseInt(id as string, 10);')
  ) {
    continue;
  }
  
  if (line.includes('const { t } = useTranslation(\'media\');')) {
    out.push(line);
    out.push(`  const traktIdNum = parseInt(id as string, 10);`);
    out.push(`  const { mediaData, computedSeasons, isLoading, refreshData, refreshComments } = useShowDetail(traktIdNum, tmdbId, showProgressMap);`);
    out.push(`  const showData = mediaData.summary;`);
    out.push(`  const castData = mediaData.cast;`);
    out.push(`  const relatedShows = mediaData.related;`);
    out.push(`  const commentsData = mediaData.comments;`);
    continue;
  }

  out.push(line);
}

let code = out.join('\n');

// Find and replace loadData
const loadDataStart = code.indexOf('  useEffect(() => {\n    if (id) {\n      loadData();');
const loadDataEnd = code.indexOf('  const handleRateEpisode = async', loadDataStart);

const tmdbUseEffect = `  useEffect(() => {
    let isMounted = true;
    const fetchTmdb = async () => {
      if (tmdbId) {
        const tmdbIdNum = parseInt(tmdbId as string, 10);
        try {
          const [bd, tr, pst] = await Promise.all([
            getShowBackdrop(tmdbIdNum),
            getShowTrailer(tmdbIdNum),
            getShowPoster(tmdbIdNum)
          ]);
          if (isMounted) {
            setBackdrop(bd);
            setTrailerId(tr);
            setPoster(pst);
          }
        } catch(e){}
      }
    };
    fetchTmdb();
    return () => { isMounted = false; };
  }, [tmdbId]);\n\n`;

code = code.slice(0, loadDataStart) + tmdbUseEffect + code.slice(loadDataEnd);

// Fix expandedSeasons logic
code = code.replace(/seasonsData\.length > 0/g, 'computedSeasons.length > 0');
code = code.replace(/seasonsData/g, 'computedSeasons');

// 5. Render Helper for Episode Badge
const renderBadgeReplacement = `const renderUnairedBadgeText = (ep: any) => {
    if (!ep.first_aired) return 'TBA';
    const diff = new Date(ep.first_aired).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 0 ? t('today') : t('daysLeft', { days: days });
  };
  
  const handleRateEpisode = async`;
code = code.replace('const handleRateEpisode = async', renderBadgeReplacement);

// Remove the Array.find inside the map
code = code.replace(/const isWatchedLocal = showProgressMap\[id as string\]\?.seasons\?.find\(\(s:any\) => s\.number === season\.number\)\?.episodes\?.find\(\(e:any\) => e\.number === ep\.number\)\?.completed;/g, 
  'const isWatchedLocal = ep.isWatchedLocal;');

// Remove IIFE in the view
code = code.replace(/\{\(\(\) => \{\n\s*const diff = new Date\(ep\.first_aired\)\.getTime\(\) - new Date\(\)\.getTime\(\);\n\s*const days = Math\.ceil\(diff \/ \(1000 \* 60 \* 60 \* 24\)\);\n\s*return days <= 0 \? t\('today'\) : t\('daysLeft', \{ days: days \}\);\n\s*\}\)\(\)\}/g,
  '{renderUnairedBadgeText(ep)}');

// Replace comment refresh logic
code = code.replace(/setCommentRefreshTrigger\(prev => prev \+ 1\)/g, 'refreshComments()');
code = code.replace(/refreshTrigger=\{commentRefreshTrigger\}/g, 'refreshTrigger={0}'); 

fs.writeFileSync('app/show/[id].tsx', code);
