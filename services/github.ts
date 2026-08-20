// F12 — app/(public)/download.web.tsx'teki ham fetch() çağrısı buraya taşındı
// (AI_RULES §1: veri çekme mantığı component'te değil services/'te olmalı).

export async function fetchBetaReleaseNotes(): Promise<string> {
  const response = await fetch(
    'https://api.github.com/repos/ArdaGunal/KaymakTv/releases/tags/beta'
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.body || '';
}
