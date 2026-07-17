const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync('services/traktApi.ts', 'utf8');

const blocks = {
  traktClient: [],
  auth: [],
  shows: [],
  movies: [],
  users: [],
  comments: [],
  search: []
};

const categorization = {
  exchangeAuthCode: 'auth',
  
  getTrendingShows: 'shows',
  getShowSummary: 'shows',
  getShowSeasons: 'shows',
  getShowCast: 'shows',
  getRelatedShows: 'shows',
  getEpisodeDetail: 'shows',
  
  getTrendingMovies: 'movies',
  getMovieSummary: 'movies',
  getMovieCast: 'movies',
  getRelatedMovies: 'movies',
  
  getHistoryEpisodes: 'users',
  getWatchedShows: 'users',
  getWatchedMovies: 'users',
  addEpisodeToHistory: 'users',
  addSeasonToHistory: 'users',
  addEpisodesBulkToHistory: 'users',
  addMovieToHistory: 'users',
  getShowProgress: 'users',
  getWatchlistShows: 'users',
  getWatchlistMovies: 'users',
  addToWatchlistTrakt: 'users',
  removeFromWatchlistTrakt: 'users',
  getCustomLists: 'users',
  createCustomList: 'users',
  deleteCustomList: 'users',
  getCustomListItems: 'users',
  addMediaToCustomList: 'users',
  removeMediaFromCustomList: 'users',
  getOrCreateLikedList: 'users',
  getLikedShows: 'users',
  getLikedMovies: 'users',
  toggleLikedMedia: 'users',
  getMyCalendarShows: 'users',
  getMyCalendarMovies: 'users',
  getUserRatings: 'users',
  addRating: 'users',
  removeRating: 'users',
  hideItemTrakt: 'users',
  removeFromHistoryTrakt: 'users',
  removeEpisodeFromHistoryTrakt: 'users',
  removeSeasonFromHistoryTrakt: 'users',
  
  addComment: 'comments',
  updateComment: 'comments',
  deleteComment: 'comments',
  getMediaComments: 'comments',
  getUserComments: 'comments',
  
  searchTrakt: 'search'
};

// We will split the file line by line
const lines = fileContent.split('\n');

let currentBlock = [];
let depth = 0;
let inExport = false;
let currentFunction = null;
let clientCode = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const exportMatch = line.match(/^export\s+(const|async function|function)\s+([a-zA-Z0-9_]+)/);
  if (exportMatch && depth === 0) {
    inExport = true;
    currentFunction = exportMatch[2];
  }

  if (inExport) {
    currentBlock.push(line);
    
    // Count braces
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    depth += (openBraces - closeBraces);
    
    if (depth === 0) {
      // Function ended
      const category = categorization[currentFunction];
      if (category) {
        blocks[category].push(currentBlock.join('\n'));
      } else {
        // Belongs to client or wasn't mapped
        clientCode.push(currentBlock.join('\n'));
      }
      inExport = false;
      currentBlock = [];
      currentFunction = null;
    }
  } else {
    // This is part of the client / top level (imports, variables, interceptors)
    clientCode.push(line);
  }
}

// Ensure the api directory exists
if (!fs.existsSync('services/api')) {
  fs.mkdirSync('services/api');
}

// Write the client file
const traktClientCode = `
${clientCode.join('\n')}
export const applyTranslationHelper = applyTranslation;
`;
// Note: We'll fix applyTranslation export so others can use it

fs.writeFileSync('services/api/traktClient.ts', traktClientCode.trim());

// Write module files
const generateImports = () => {
  return `import { traktApi } from './traktClient';\n`;
};

const moduleDependencies = {
  auth: "import { traktApi } from './traktClient';\n",
  shows: "import { traktApi, applyTranslation } from './traktClient';\nimport i18n from '../../locales/index';\n",
  movies: "import { traktApi, applyTranslation } from './traktClient';\nimport i18n from '../../locales/index';\n",
  users: "import { traktApi } from './traktClient';\n",
  comments: "import { traktApi } from './traktClient';\n",
  search: "import { traktApi, applyTranslation } from './traktClient';\nimport i18n from '../../locales/index';\n"
};

for (const [key, value] of Object.entries(blocks)) {
  if (key === 'traktClient' || value.length === 0) continue;
  
  let deps = moduleDependencies[key];
  
  const code = `${deps}\n${value.join('\n\n')}\n`;
  fs.writeFileSync(`services/api/${key}.ts`, code);
}

// Write the barrel file
const barrelCode = `
export * from './api/traktClient';
export * from './api/auth';
export * from './api/shows';
export * from './api/movies';
export * from './api/users';
export * from './api/comments';
export * from './api/search';
`;

fs.writeFileSync('services/traktApi.ts', barrelCode.trim() + '\n');
console.log('Split successful.');
