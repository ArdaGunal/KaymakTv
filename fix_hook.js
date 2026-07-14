const fs = require('fs');
let code = fs.readFileSync('hooks/useEpisodeDetail.ts', 'utf8');
code = code.replace("import { getEpisodeDetail, getEpisodeComments, getEpisodeStill } from '../services/traktApi';", 
"import { getEpisodeDetail, getEpisodeComments } from '../services/traktApi';\nimport { getEpisodeStill } from '../services/tmdbApi';");
fs.writeFileSync('hooks/useEpisodeDetail.ts', code);
