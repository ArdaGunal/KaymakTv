import React from 'react';
import LegalDocument from '../../components/public/LegalDocument';

/**
 * Topluluk Kuralları — herkese açık, girişsiz adres (YAYIN_ONCESI_PLAN Adım 4a).
 * Google Play UGC politikası sakıncalı içeriğin tanımlanıp yasaklanmasını ister;
 * kural onayı penceresi (`components/rules/KuralOnayiPenceresi`) de buraya bağlanır.
 */
export default function ToplulukKurallariScreen() {
  return <LegalDocument belge="rules" />;
}
