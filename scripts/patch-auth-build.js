const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(indexPath, 'utf8');

const startMarker = '        // 2. Handle Google OAuth redirect callback (PKCE code in URL)';
const endMarker = '        // 3. Check existing real session';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('Expected PKCE callback block was not found in index.html');
}

const replacement = `        // 2. OAuth callback handling is automatic. The Supabase client is configured
        // with detectSessionInUrl=true + flowType=pkce, so it consumes the callback
        // code during initialization and emits INITIAL_SESSION / SIGNED_IN above.
        // Do not call exchangeCodeForSession() a second time: PKCE auth codes are single-use.

`;
source = source.slice(0, start) + replacement + source.slice(end);

const oldRedirect = `const redirectUri = (!isLocal && window.location.origin && window.location.origin !== "null")
          ? window.location.origin.replace(/\/$/, "")
          : "https://munnaai.youmika.site";`;
const newRedirect = `const redirectUri = (!isLocal && window.location.origin && window.location.origin !== "null")
          ? window.location.origin + window.location.pathname
          : "https://munnaai.youmika.site/";`;

if (!source.includes(oldRedirect)) {
  throw new Error('Expected OAuth redirect URI block was not found in index.html');
}
source = source.replace(oldRedirect, newRedirect);

fs.writeFileSync(indexPath, source, 'utf8');
console.log('Auth build patch applied successfully.');
