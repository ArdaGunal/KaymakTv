import { HIDDEN_OUTBOX_PREFIX, validHiddenJob, type HiddenDraft, type HiddenJob, type HiddenSession, type HiddenSnapshot } from './types';

type Ports = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  send: (job: HiddenJob, session: HiddenSession) => Promise<void>;
  snapshot: (session: HiddenSession, jobs: HiddenJob[]) => Promise<HiddenSnapshot>;
  apply: (snapshot: HiddenSnapshot) => void;
  changed: (jobs: HiddenJob[], error: boolean) => void;
};

/** Gizleme SET işlemidir: belirsiz yanıt aynı sıralı niyetlerle güvenle tekrarlanır. */
export function createHiddenOutbox(ports: Ports) {
  let session: HiddenSession | null = null;
  let generation = 0;
  let jobs: HiddenJob[] = [];
  let loaded = false;
  let serial = Promise.resolve();
  let flight: Promise<void> | null = null;
  let counter = 0;
  const lock = <T>(work: () => Promise<T>) => {
    const task = serial.then(work);
    serial = task.then(() => {}, () => {});
    return task;
  };
  const valid = (s: HiddenSession, gen: number) => session === s && generation === gen;
  const save = (owner: string, list: HiddenJob[]) =>
    ports.write(HIDDEN_OUTBOX_PREFIX + owner, JSON.stringify({ version: 1, jobs: list }));
  const stop = () => {
    generation++;
    session = null;
    loaded = false;
    jobs = [];
    ports.changed([], false);
  };
  const start = async (s: HiddenSession) => {
    stop();
    session = s;
    const gen = generation;
    await flight?.catch(() => {});
    await lock(async () => {
      const raw = await ports.read(HIDDEN_OUTBOX_PREFIX + s.owner);
      if (!valid(s, gen)) return;
      if (raw) {
        const data = JSON.parse(raw);
        if (data.version !== 1 || !Array.isArray(data.jobs)
          || !data.jobs.every((j: HiddenJob) => validHiddenJob(j, s.owner))
          || new Set(data.jobs.map((j: HiddenJob) => j.id)).size !== data.jobs.length) {
          throw new Error('Gizleme günlüğü okunamadı; üzerine yazılmadı.');
        }
        jobs = data.jobs;
      }
      loaded = true;
      ports.changed(jobs, false);
    });
  };
  const enqueue = async (draft: HiddenDraft) => {
    if (!session || !loaded) throw new Error('Gizleme kuyruğu için oturum hazır değil.');
    const s = session, gen = generation;
    const job: HiddenJob = { mediaType: draft.mediaType, mediaId: draft.mediaId, hidden: draft.hidden,
      id: `${Date.now()}-${++counter}-${Math.random().toString(36).slice(2)}`, owner: s.owner, trakt: s.trakt };
    if (!validHiddenJob(job, s.owner)) throw new Error('Geçersiz gizleme işlemi.');
    await lock(async () => {
      if (!valid(s, gen)) throw new Error('Gizleme oturumu değişti.');
      const next = [...jobs, job];
      await save(s.owner, next); // Disk ACK ÖNCE, UI ve HTTP SONRA.
      if (!valid(s, gen)) throw new Error('Gizleme oturumu değişti.');
      jobs = next;
      ports.changed(jobs, false);
    });
    return job;
  };
  const drain = (): Promise<void> => {
    if (flight) return flight;
    if (!session || !loaded || !jobs.length) return Promise.resolve();
    const s = session, gen = generation;
    const run = async () => {
      try {
        while (valid(s, gen) && jobs.length) {
          const batch = [...jobs];
          for (const job of batch) {
            if (!valid(s, gen)) return;
            await ports.send(job, s);
          }
          if (!valid(s, gen)) return;
          const snapshot = await ports.snapshot(s, batch);
          if (!valid(s, gen)) return;
          // HTTP 200 tek başına yetmez: son niyetin TAM sunucu listesinde karşılığı gerekir.
          const last = new Map(batch.map((j) => [`${j.mediaType}/${j.mediaId}`, j]));
          if ([snapshot.show, snapshot.movie].some((ids) => !Array.isArray(ids)
            || ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
            || [...last.values()].some((j) => snapshot[j.mediaType].includes(j.mediaId) !== j.hidden)) {
            throw new Error('Gizleme sunucuda henüz doğrulanamadı; günlük korunuyor.');
          }
          await lock(async () => {
            if (!valid(s, gen)) return;
            ports.apply(snapshot); // Yeni niyetler projection ile bu okumanın üstünde kalır.
            const completed = new Set(batch.map((j) => j.id));
            const next = jobs.filter((j) => !completed.has(j.id));
            await save(s.owner, next);
            if (!valid(s, gen)) return;
            jobs = next;
            ports.changed(jobs, false);
          });
        }
      } catch (error) {
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
