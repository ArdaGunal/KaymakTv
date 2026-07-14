const fs = require('fs');

const textToAppend = `

## 17. TBA (Yayınlanmayan Bölüm) Düzeltmesi ve Performans Artışı (Refactoring)
**Sorun:** Yayınlanmayan bölümler için TBA gösterimi sırasında, Trakt veritabanında eski bölümlerin tarihlerinin null gelmesi sebebiyle yayınlanmış eski bölümler de TBA (Kilitli) olarak kalıyordu. Ayrıca \`show/[id].tsx\` içindeki render döngüsünde \`Array.find\` kullanımı nedeniyle performans darboğazı yaşanıyordu.
**Çözüm:**
1. TBA sorunu, Trakt'tan gelen \`season.aired_episodes\` verisinin saklanıp, bölüm sırasına göre hesaplama yapılmasıyla çözüldü. Tarih eksiği olsa bile \`aired_episodes\` sayısından küçük/eşit olanlar yayınlanmış kabul edildi.
2. Yaklaşanlar sekmesindeki ve bölüm içi TBA/Sayaç mantığı için DateHelper içindeki \`getDateGroup\` güncellenerek çoklu dil desteği (i18n \`t\` fonksiyonu) eklendi.
3. Performans krizini çözmek için uygulamanın en karmaşık sayfaları (\`show/[id].tsx\` ve \`episode/[id].tsx\`) tamamen modüler hale getirildi. 
4. Veri çekme ve state yönetimleri \`hooks/useShowDetail.ts\` ve \`hooks/useEpisodeDetail.ts\` içerisine soyutlandı. Render anındaki ağır işlemler \`useMemo\` içine alınarak sızmalar önlendi.
5. \`utils/cacheManager.ts\` oluşturularak AsyncStorage kotaları ve Garbage Collection işlemleri merkezileştirildi. Kodlardaki tüm spagetti (IIFE) yapıları temizlenerek sistem stabilitesi sağlandı.
`;

fs.appendFileSync('docs/HISTORY.md', textToAppend);
console.log('HISTORY.md updated.');
