// M447: eski uçuş-belleği yerine disk ACK'li niyetlerin aynı projection'ı.
// Frozen fetchers'ın mevcut imzası korunur; cache/store da aynı katmandan
// geçer. Çıkışta projection temizlenir, hesaba özel günlük silinmez.
export { projectHiddenIds as reconcileHiddenIds } from './hiddenOutbox/projection';
