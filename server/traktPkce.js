const TRAKT_PKCE_TOKEN_URL = 'https://auth.trakt.tv/oauth/token';

const isAllowedRedirectUri = (uri) => uri === 'https://kaymaktv.com/settings';

const isValidCodeVerifier = (verifier) =>
  typeof verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(verifier);

function pkceTokenPayload({ code, code_verifier, redirect_uri }, clientId) {
  return {
    code,
    code_verifier,
    redirect_uri,
    client_id: clientId,
    grant_type: 'authorization_code',
  };
}

module.exports = { TRAKT_PKCE_TOKEN_URL, isAllowedRedirectUri, isValidCodeVerifier, pkceTokenPayload };
