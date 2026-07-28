-- İnce taneli akış gizlilik ayarları — mevcut `feed_hidden` ("her şeyi
-- gizle") anahtarının yanına, tür bazında kontrol ekler. Kullanıcı örneğin
-- yalnızca puanlarını gizleyip izleme aktivitesini paylaşmaya devam edebilir.
ALTER TABLE users ADD COLUMN publish_watches BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN publish_ratings BOOLEAN NOT NULL DEFAULT TRUE;
