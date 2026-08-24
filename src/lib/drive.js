/*
  Google Drive storage client — server-side only.

  Authenticates as YOUR personal Google account via OAuth (not a service
  account — a service account's uploads count against its own fixed 15GB
  quota, not your 5TB). See scripts/get-refresh-token.js for the one-time
  setup.

  Replaces src/lib/gcs.js from the GCS plan. Firestore metadata is unchanged.
*/

import { google } from 'googleapis';

function getOAuth2Client() {
  const required = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var ${key} — see scripts/get-refresh-token.js`);
  }
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return client;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getOAuth2Client() });
}

async function withDriveErrorHandling(operation) {
  try {
    return await operation();
  } catch (err) {
    if (
      err.message?.includes('invalid_grant') ||
      err.message?.includes('Token has been expired or revoked') ||
      err.response?.data?.error === 'invalid_grant'
    ) {
      const error = new Error('DRIVE_AUTH_REVOKED');
      error.code = 'DRIVE_AUTH_REVOKED';
      throw error;
    }
    throw err;
  }
}

// Optional: a folder in your Drive that every event's folder nests under,
// so uploads don't scatter across your Drive root. Create it once by hand
// in Drive, copy its ID from the URL, put it in GOOGLE_DRIVE_ROOT_FOLDER_ID.
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;

/**
 * Creates a new Drive folder for an event. Called ONCE at event-creation
 * time (not per-upload) to avoid the race condition where concurrent
 * uploads to a new event each create their own folder.
 *
 * The folder is named by eventId (stable, machine-readable); the human-
 * readable event name goes in the description for when you browse Drive.
 *
 * Returns the folder's Drive file ID.
 */
export async function createEventFolder(eventId, eventName) {
  return withDriveErrorHandling(async () => {
    const drive = getDriveClient();

    const folder = await drive.files.create({
      requestBody: {
        name: eventId,
        description: eventName || '',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ROOT_FOLDER_ID ? [ROOT_FOLDER_ID] : undefined,
      },
      fields: 'id',
    });
    return folder.data.id;
  });
}

/**
 * Uploads a file into the given folder from a readable STREAM (not a
 * Buffer) — the googleapis client handles chunked/resumable upload
 * internally for streams, so this scales to large photos and video
 * without buffering the whole file server-side first. Then makes the
 * file viewable by anyone with the link, since Drive files are private
 * by default.
 */
export async function uploadToDrive({ stream, filename, mimeType, folderId }) {
  return withDriveErrorHandling(async () => {
    const drive = getDriveClient();

    const created = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType: mimeType || 'application/octet-stream', body: stream },
      fields: 'id',
    });
    const fileId = created.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return {
      fileId,
      // Good for <img src> and for streaming playback of video.
      viewUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
      // Forces a download rather than an inline view — use for "download original".
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  });
}

export async function deleteFromDrive(fileId) {
  if (!fileId) return;
  return withDriveErrorHandling(async () => {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
  });
}

export async function getResumableUploadSessionUrl({ filename, mimeType, folderId }) {
  return withDriveErrorHandling(async () => {
    const authClient = getOAuth2Client();
    const tokenRes = await authClient.getAccessToken();
    const token = tokenRes.token;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
      },
      body: JSON.stringify({
        name: filename,
        parents: [folderId]
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to create resumable session: ${await res.text()}`);
    }

    return res.headers.get('Location');
  });
}

export async function finalizeDriveUpload(fileId) {
  return withDriveErrorHandling(async () => {
    const drive = getDriveClient();
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return {
      fileId,
      viewUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  });
}
