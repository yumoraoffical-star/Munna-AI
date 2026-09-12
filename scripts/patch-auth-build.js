const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'index.html');
const source = fs.readFileSync(indexPath, 'utf8');

const callbackPattern = /\n\s*\/\/ 2\. Handle Google OAuth redirect callback \(PKCE code in URL\)[\s\S]*?\n\s*\/\/ 3\. Check existing real session\n/;

const callbackReplacement = `\n\n        // 2. OAuth callback handling is automatic. The Supabase client is configured\n        // with detectSessionInUrl=true + flowType=pkce, so it consumes the callback\n        // code during initialization and emits INITIAL_SESSION / SIGNED_IN above.\n        // Do not call exchangeCodeForSession() a second time: PKCE auth codes are single-use.\n\n        // 3. Check existing real session\n`;

if (!callbackPattern.test(source)) {
  throw new Error('Expected PKCE callback block was not found in index.html');
}

let output = source.replace(callbackPattern, callbackReplacement);

const redirectPattern = /const redirectUri = \(!isLocal && window\.location\.origin && window\.location\.origin !== "null"\)\s*\n\s*\? window\.location\.origin\.replace\(\/\\\\\/$\/\, ""\)\s*\n\s*: "https:\/\/munnaai\.youmika\.site";/;

if (!redirectPattern.test(output)) {
  throw new Error('Expected OAuth redirect URI block was not found in index.html');
}

output = output.replace(
  redirectPattern,
  `const redirectUri = (!isLocal && window.location.origin && window.location.origin !== "null")\n          ? window.location.origin + window.location.pathname\n          : "https://munnaai.youmika.site/";`
);

fs.writeFileSync(indexPath, output, 'utf8');
console.log('Auth build patch applied successfully.');
