const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Remove COOP/COEP headers that block OAuth popups on the local dev server
const originalEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, server) => {
  const customMiddleware = (req, res, next) => {
    // Remove Cross-Origin headers that prevent the OAuth popup from communicating back to the app
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    return middleware(req, res, next);
  };
  
  if (originalEnhanceMiddleware) {
    return originalEnhanceMiddleware(customMiddleware, server);
  }
  return customMiddleware;
};

module.exports = config;
