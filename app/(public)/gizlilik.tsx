import React from 'react';
import LegalDocument from '../../components/public/LegalDocument';

/**
 * Gizlilik Politikası — herkese açık, girişsiz adres (`kaymaktv.com/gizlilik`).
 * Google Play «Uygulama içeriği» formuna yazılan bağlantı budur. Metin ve düzen:
 * `components/public/LegalDocument.tsx` + `locales/<dil>/legal.json` (`privacySections`).
 */
export default function GizlilikScreen() {
  return <LegalDocument belge="privacy" />;
}
