import { OUTBOX_PREFIX, validateJob, type WatchedDraft, type WatchedJob, type WatchedPart, type OutboxSession } from './types';

type Ports = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  expand: (job: WatchedJob, part: WatchedPart, session: OutboxSession) => Promise<number[]>;
  kaymak: (job: WatchedJob, part: WatchedPart, session: OutboxSession) => Promise<void>;
  trakt: (job: WatchedJob, part: WatchedPart, session: OutboxSession) => Promise<void>;
  publish: (job: WatchedJob, session: OutboxSession) => Promise<void>;
  refresh: (session: OutboxSession) => Promise<void>;
  changed: (jobs: WatchedJob[], error: boolean) => void;
};

/** Yaz-önce günlüğü. Tek sürücü, seri disk güncellemeleri, sabit tarih damgası. */
export function createWatchedOutbox(ports: Ports) {
  let session: OutboxSession | null = null;
  let generation = 0;
  let jobs: WatchedJob[] = [];
  let loaded = false;
  let serial = Promise.resolve();
  let flight: Promise<void> | null = null;
  let counter = 0;
  const lock = <T>(work: () => Promise<T>): Promise<T> => {
    const task = serial.then(work);
    serial = task.then(() => {}, () => {});
    return task;
  };
  const valid = (s: OutboxSession, gen: number) => session === s && generation === gen;
  const save = (owner: string, list: WatchedJob[]) =>
    ports.write(OUTBOX_PREFIX + owner, JSON.stringify({ version: 1, jobs: list }));
  const requireSession = () => {
    if (!session || !loaded) throw new Error('İşaretleme kuyruğu için oturum henüz hazır değil.');
    return session;
  };
  const update = (s: OutboxSession, gen: number, id: string, job: WatchedJob) => lock(async () => {
    if (!valid(s, gen)) throw new Error('İşaretleme oturumu değişti.');
    const next = jobs.map((j) => j.id === id ? job : j);
    await save(s.owner, next);
    if (!valid(s, gen)) throw new Error('İşaretleme oturumu değişti.');
    jobs = next;
    ports.changed(jobs, false);
  });

  const stop = () => {
    generation++;
    session = null;
    loaded = false;
    jobs = [];
    ports.changed([], false);
  };
  const start = async (s: OutboxSession) => {
    stop();
    session = s;
    const gen = generation;
    // Önceki oturumun uçuşu bitmeden belirsiz Trakt POST'u tekrarlanmaz.
    await flight?.catch(() => {});
    await lock(async () => {
      const raw = await ports.read(OUTBOX_PREFIX + s.owner);
      if (!valid(s, gen)) return;
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version !== 1 || !Array.isArray(data.jobs)
          || !data.jobs.every((j: WatchedJob) => validateJob(j, s.owner))) {
          throw new Error('İşaretleme günlüğü okunamadı; korunuyor, üzerine yazılmadı.');
        }
        jobs = data.jobs;
      }
      loaded = true;
      ports.changed(jobs, false);
    });
  };
  const enqueue = async (draft: WatchedDraft) => {
    const s = requireSession();
    const gen = generation;
    const job: WatchedJob = { ...draft, id: `${Date.now()}-${++counter}-${Math.random().toString(36).slice(2)}`, owner: s.owner, trakt: s.trakt };
    if (!validateJob(job, s.owner)) throw new Error('Geçersiz işaretleme işlemi.');
    await lock(async () => {
      if (!valid(s, gen)) throw new Error('İşaretleme oturumu değişti.');
      const next = [...jobs, job];
      // setItem tamamlanmadan başarı/iyimser tik ve ağ yazması YOK.
      await save(s.owner, next);
      if (!valid(s, gen)) throw new Error('İşaretleme oturumu değişti.');
      jobs = next;
      ports.changed(jobs, false);
    });
    return job;
  };
  const drain = (): Promise<void> => {
    if (flight) return flight;
    if (!session || !loaded || jobs.length === 0) return Promise.resolve();
    const s = session;
    const gen = generation;
    const run = async () => {
      try {
        while (valid(s, gen) && jobs.length > 0) {
          const pendingJob = jobs.find((j) => !j.feedDone);
          if (!pendingJob) {
            const completed = new Set(jobs.map((j) => j.id));
            await ports.refresh(s);
            await lock(async () => {
              if (!valid(s, gen)) return;
              const next = jobs.filter((j) => !completed.has(j.id));
              await save(s.owner, next);
              if (!valid(s, gen)) return;
              jobs = next;
              ports.changed(jobs, false);
            });
            continue;
          }
          let job = JSON.parse(JSON.stringify(pendingJob)) as WatchedJob;
          for (let i = 0; i < job.parts.length; i++) {
            let part = job.parts[i];
            if (!valid(s, gen)) return;
            if (part.episodes === '*') {
              part.episodes = await ports.expand(job, part, s);
              if (!part.episodes.length) throw new Error('İşaretlenecek bölüm bulunamadı.');
              await update(s, gen, job.id, job);
            }
            if (!part.kaymakDone) {
              await ports.kaymak(job, part, s);
              part.kaymakDone = true;
              await update(s, gen, job.id, job);
            }
            if (job.trakt && !part.traktDone) {
              if (!valid(s, gen)) return;
              // Trakt POST idempotent DEĞİL: uçuş notu önce diske, belirsiz
              // uçuşun tekrarında adaptör geçmişi kontrol edip yalnız eksik yazar.
              const replay = !!part.traktStarted;
              part.traktStarted = true;
              await update(s, gen, job.id, job);
              if (!valid(s, gen)) return;
              await ports.trakt(job, { ...part, traktStarted: replay }, s);
              part.traktDone = true;
              await update(s, gen, job.id, job);
            }
          }
          if (!valid(s, gen)) return;
          if (!job.feedDone) {
            await ports.publish(job, s);
            job.feedDone = true;
            await update(s, gen, job.id, job);
          }
          // Hızlı bir turun bütün yazmaları biter, sonra TEK tam tazeleme.
        }
      } catch (error) {
        // Oturum kapandıysa eski uçuşun sonucu yeni hesaba uygulanmaz.
        // Diskteki son checkpoint aynı sahibin sonraki girişinde sürdürülür.
        if (!valid(s, gen)) return;
        ports.changed(jobs, true);
        throw error;
      }
    };
    const promise = run().finally(() => { if (flight === promise) flight = null; });
    flight = promise;
    return promise;
  };
  return { start, stop, enqueue, drain, current: () => session, pending: () => jobs };
}
