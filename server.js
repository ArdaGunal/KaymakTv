require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4830;

app.use(cors());
app.use(express.json());

// ==========================================
// TMDB PROXY ENDPOINT
// ==========================================
app.get('/api/tmdb', async (req, res) => {
  try {
    const tmdbApiKey = process.env.TMDB_API_KEY || process.env.EXPO_PUBLIC_TMDB_API_KEY;
    if (!tmdbApiKey) {
      return res.status(500).json({ error: 'Server configuration error (missing TMDB_API_KEY)' });
    }

    let endpoint = req.query.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    const queryParams = { ...req.query };
    delete queryParams.endpoint;

    const tmdbResponse = await axios.get(`https://api.themoviedb.org/3${endpoint}`, {
      params: {
        ...queryParams,
        api_key: tmdbApiKey,
      },
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(tmdbResponse.data);
  } catch (error) {
    console.error('Error in TMDB proxy:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Internal Server Error',
      details: error.message
    });
  }
});

// ==========================================
// TRAKT AUTH ENDPOINT
// ==========================================
app.post('/api/trakt', async (req, res) => {
  try {
    const { code, refresh_token, redirect_uri } = req.body;

    if (!code && !refresh_token) {
      return res.status(400).json({ error: 'Authorization code or refresh token is required' });
    }

    const clientId = process.env.TRAKT_CLIENT_ID || process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    const clientSecret = process.env.TRAKT_CLIENT_SECRET || process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Server configuration error (missing Trakt credentials)' });
    }

    const payload = refresh_token ? {
      refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || 'kaymak://settings',
      grant_type: 'refresh_token',
    } : {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || 'kaymak://settings',
      grant_type: 'authorization_code',
    };

    const traktResponse = await axios.post('https://api.trakt.tv/oauth/token', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    res.json(traktResponse.data);
  } catch (error) {
    console.error('Error in Trakt Auth proxy:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Internal Server Error',
      details: error.message
    });
  }
});

// ==========================================
// STATIC FILES & SPA FALLBACK
// ==========================================
app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`🚀 Kaymak Server is running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`==========================================`);
});
