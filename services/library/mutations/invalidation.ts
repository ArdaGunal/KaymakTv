import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dizi/film detay ekranlarının kendi diskteki (AsyncStorage) önbelleklerini
 * hedefe yönelik olarak temizler.
 *
 * Sorun: `useShowDetail`/`useMovieDetail`'in `refreshData()` fonksiyonu
 * eskiden yalnızca bir React state sayacını (`refreshTrigger`) artırıyordu —
 * ancak bu sayaç değiştiğinde tetiklenen `loadData`/`fetchDetails` HER ZAMAN
 * önce AsyncStorage'daki diski kontrol ediyor (`cacheManager.get` / doğrudan
 * `AsyncStorage.getItem`), TTL süresi (6 saat / 24 saat) henüz dolmadıysa
 * aynı bayat veriyi (`summary`, `seasons`, `cast`, `related`) geri
 * döndürüyordu. Sonuç: kullanıcı bir yorum yazıp/silip "yenile" akışını
 * tetiklediğinde (örn. yorum sayısının güncellenmesi için) `refreshData()`
 * TTL penceresi içindeyse SESSİZCE hiçbir şey yapmıyordu.
 *
 * Bu fonksiyonlar diski açıkça silerek bir sonraki `loadData`/`fetchDetails`
 * çağrısının cache-miss alıp GERÇEK bir ağ isteği atmasını garanti eder.
 * Silme başarısız olursa (örn. AsyncStorage geçici hatası) sessizce yoksayılır
 * — en kötü ihtimalle bir sonraki doğal TTL dolumuna kadar eski davranış sürer,
 * bu da zaten önceki durumdu (regresyon yok).
 */
export const invalidateShowDetailCache = async (showId: number): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`@show_detail_v3_${showId}`);
  } catch {
    // yoksay — bir sonraki TTL dolumunda kendiliğinden tazelenir.
  }
};

export const invalidateMovieDetailCache = async (movieId: number): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`@movie_detail_v4_cache_${movieId}`);
  } catch {
    // yoksay
  }
};
