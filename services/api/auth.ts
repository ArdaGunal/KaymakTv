import axios from 'axios';
import { getTraktClient } from './traktClient';

export const exchangeAuthCode = async (code: string, redirectUri: string) => {
  try {
    const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Trakt Client ID veya Secret bulunamadı. Lütfen .env dosyasını kontrol edin.');
    }

    const response = await axios.post('https://api.trakt.tv/oauth/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
    return response.data; // { access_token, refresh_token, ... }
  } catch (error: any) {
    console.error('exchangeAuthCode Hatası:', error?.response?.data || error);
    throw error;
  }
};
