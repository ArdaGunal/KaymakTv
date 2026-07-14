import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Safari'de Native App gibi tam ekran açılması için: */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Safari Status Bar'ı siyah ve transparan yapmak için: */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Pinch-to-zoom'u kapatmak için (Native hissiyat): */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        
        <title>Kaymak</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <ScrollViewStyleReset />
        
        {/* Native hissiyat için Web'de yazıları seçmeyi ve resimlere basılı tutunca menü çıkmasını engelle */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background-color: #0B1120;
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            overflow: hidden;
          }
          /* Giriş alanlarında klavye açılmasına izin ver */
          input, textarea {
            -webkit-user-select: auto;
            user-select: auto;
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
