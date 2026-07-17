import os
import re

files_to_modify = [
    r'app/(protected)/(tabs)/movies.web.tsx',
    r'app/(protected)/(tabs)/profile.web.tsx',
    r'app/(protected)/(tabs)/shows.web.tsx',
    r'app/(protected)/list/[id].tsx',
    r'app/episode/[id].tsx',
    r'app/movie/[id].tsx',
    r'app/show/[id].tsx',
    r'components/movies/MovieCard.web.tsx',
    r'components/movies/MovieCardMobile.tsx',
    r'components/AddToListModal.tsx',
    r'components/EpisodeCheckButton.tsx',
    r'components/MediaHero.tsx',
    r'components/SeasonAccordion.tsx',
    r'components/ShowCard.tsx',
    r'screens/IndexMobile.tsx',
    r'screens/MoviesMobile.tsx',
    r'screens/ProfileMobile.tsx'
]

state_props = {
    'watchedShows', 'watchedMovies', 'customLists', 'favShows', 'favMovies',
    'watchlistShows', 'calendarShows', 'watchlistMovies', 'calendarMovies',
    'userRatingsShows', 'userRatingsMovies', 'userRatingsEpisodes',
    'showProgressMap', 'calendarSeasonsMap', 'isLoading', 'isMoviesLoading'
}

for filepath in files_to_modify:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'useLibrary()' not in content:
        continue
        
    # Find context path
    content = re.sub(
        r'import\s+\{\s*useLibrary\s*\}\s+from\s+[\'\"].*?context/LibraryContext[\'\"];', 
        "import { useLibraryStore } from '@/store/useLibraryStore';\nimport * as LibraryService from '@/services/libraryService';", 
        content
    )
    content = re.sub(
        r'import\s+\{\s*useLibrary\s*\}\s+from\s+[\'\"].*?LibraryContext[\'\"];', 
        "import { useLibraryStore } from '@/store/useLibraryStore';\nimport * as LibraryService from '@/services/libraryService';", 
        content
    )

    pattern = r'const\s+\{([\s\S]*?)\}\s*=\s*useLibrary\(\);'
    match = re.search(pattern, content)
    if not match:
        continue
        
    vars_str = match.group(1)
    vars = [v.strip() for v in vars_str.split(',') if v.strip()]
    
    new_lines = []
    for v in vars:
        if ':' in v:
            orig, alias = [part.strip() for part in v.split(':')]
            if orig in state_props:
                new_lines.append(f'const {alias} = useLibraryStore(state => state.{orig});')
            else:
                new_lines.append(f'const {alias} = LibraryService.{orig};')
        else:
            if v in state_props:
                new_lines.append(f'const {v} = useLibraryStore(state => state.{v});')
            else:
                new_lines.append(f'const {v} = LibraryService.{v};')
                
    replacement = '\n  '.join(new_lines)
    content = content[:match.start()] + replacement + content[match.end():]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print('Done modifying files.')
