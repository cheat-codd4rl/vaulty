// scripts/get-refresh-token.js
//
// Run this ONCE, locally, signed in as the personal Google account whose
// Drive storage (your 5TB Google AI Pro plan) will hold uploaded photos.
// It prints a refresh token — put that in .env.local and you never need
// to run this again unless you revoke access or lose the token.
//
// Setup before running:
//   1. In the same GCP project you used for Firestore, enable the
//      "Google Drive API" (APIs & Services > Enable APIs).
//   2. APIs & Services > Credentials > Create Credentials > OAuth client ID
//      > type "Web application".
//   3. Under "Authorized redirect URIs", add exactly:
//        http://localhost:3000/oauth2callback
//   4. Copy the generated Client ID and Client Secret.
//
// Usage:
//   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy node scripts/get-refresh-token.js

const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET before running this script.');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // required to get a refresh_token back, not just a short-lived access token
  prompt: 'consent',      // forces Google to issue a refresh_token even if you've authorized this app before
  // drive.file scope: this app can only see/manage files IT creates, not your whole Drive.
  // Safer than the full 'drive' scope, and all this app needs.
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\nOpen this URL, sign in as the account with the 5TB plan, and approve access:\n');
console.log(authUrl + '\n');

const server = http.createServer(async (req, res) => {
  const q = url.parse(req.url, true).query;
  if (!q.code) return;

  res.end('Done — you can close this tab and go back to your terminal.');
  server.close();

  try {
    const { tokens } = await oAuth2Client.getToken(q.code);
    if (!tokens.refresh_token) {
      console.log(
        "\nNo refresh_token was returned — this usually means you've authorized this app before. " +
        'Revoke its access at https://myaccount.google.com/permissions and run this script again.\n'
      );
      return;
    }
    console.log('\nAdd this line to your .env.local:\n');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err.message);
  }
});

server.listen(3000, () => {});
