const fs = require('fs');

const lines = fs.readFileSync('app/episode/[id].backup.tsx', 'utf8').split(/\r?\n/);
let out = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes(`import AsyncStorage from '@react-native-async-storage/async-storage';`)) continue;
  if (line.includes(`import { getEpisodeDetail, getEpisodeComments, addRating, removeRating }`)) {
    out.push(`import { addRating, removeRating } from '../../services/traktApi';\nimport { useEpisodeDetail } from '../../hooks/useEpisodeDetail';`);
    continue;
  }
  
  if (line.includes('const [isLoading, setIsLoading] = useState(true);') ||
      line.includes('const [episodeData, setEpisodeData] = useState<any>(null);') ||
      line.includes('const [commentsData, setCommentsData] = useState<any[]>([]);') ||
      line.includes('const [castData, setCastData] = useState<any[]>([]);') ||
      line.includes('const [stillUrl, setStillUrl] = useState<string | null>(null);') ||
      line.includes('const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);')
  ) {
    continue;
  }
  
  if (line.includes('const { t } = useTranslation(\'media\');')) {
    out.push(line);
    out.push(`  const { mediaData, isLoading, refreshData } = useEpisodeDetail(showId, showTmdbId, season, episode);`);
    out.push(`  const episodeData = mediaData.detail;`);
    out.push(`  const commentsData = mediaData.comments;`);
    out.push(`  const castData = mediaData.cast;`);
    out.push(`  const stillUrl = mediaData.stillUrl;`);
    continue;
  }

  out.push(line);
}

let code = out.join('\n');

const loadDataStart = code.indexOf('  useEffect(() => {\n    if (showId && season && episode) {\n      loadData();');
const loadDataEnd = code.indexOf('  const toggleSpoiler =', loadDataStart);
code = code.slice(0, loadDataStart) + code.slice(loadDataEnd);

// Replace comment refresh logic
code = code.replace(/setCommentRefreshTrigger\(prev => prev \+ 1\)/g, 'refreshData()');
code = code.replace(/refreshTrigger=\{commentRefreshTrigger\}/g, 'refreshTrigger={0}'); 
code = code.replace(/onDeleteSuccess=\{() => loadData\(\)\}/g, 'onDeleteSuccess={() => refreshData()}');
code = code.replace(/loadData\(\)/g, 'refreshData()');

fs.writeFileSync('app/episode/[id].tsx', code);
