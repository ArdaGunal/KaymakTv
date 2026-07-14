const fs = require('fs');

let code = fs.readFileSync('services/tmdbApi.ts', 'utf8');

// Replace the hardcoded string with dynamic logic, but we have to declare it after `isWeb` is defined
// Wait, in tmdbApi.ts, `isWeb` is defined right below it!
// Let's just fix it properly.

code = code.replace(
  "const TMDB_PROXY_URL = 'https://kaymak.netlify.app/.netlify/functions/tmdb-proxy';",
  ""
);

code = code.replace(
  "const isLocalhost = typeof window !== 'undefined' && ",
  "const TMDB_PROXY_URL = isWeb && typeof window !== 'undefined' ? `${window.location.origin}/.netlify/functions/tmdb-proxy` : 'https://kaymaktv.netlify.app/.netlify/functions/tmdb-proxy';\nconst isLocalhost = typeof window !== 'undefined' && "
);

fs.writeFileSync('services/tmdbApi.ts', code);
console.log('Done');
