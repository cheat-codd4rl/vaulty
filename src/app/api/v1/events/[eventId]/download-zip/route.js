import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';
import { getDriveClient } from '@/lib/drive';
import JSZip from 'jszip';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel function timeout limit

function nodeStreamToReadableStream(nodeStream) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => {
        controller.enqueue(new Uint8Array(chunk));
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', err => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    }
  });
}

export async function GET(request, { params }) {
  try {
    const { eventId } = await params;
    
    // 1. Authenticate (check host session first, then guest session)
    const hostCookie = request.cookies.get('vaulty_host_session')?.value;
    const guestCookie = request.cookies.get(`vaulty_guest_${eventId}`)?.value;
    
    let isHost = false;
    let isGuest = false;
    
    if (hostCookie) {
      try {
        const decoded = verifyJwt(hostCookie);
        const eventDoc = await adminDb.collection('events').doc(eventId).get();
        if (decoded.role === 'host' && eventDoc.exists && eventDoc.data().hostId === decoded.hostId) {
          isHost = true;
        }
      } catch (err) {}
    }
    
    if (!isHost && guestCookie) {
      try {
        const decoded = verifyJwt(guestCookie);
        if (decoded.role === 'guest' && decoded.eventId === eventId) {
          isGuest = true;
        }
      } catch (err) {}
    }
    
    if (!isHost && !isGuest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve requested files
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const allParam = searchParams.get('all') === 'true';
    
    if (!idsParam && !allParam) {
      return NextResponse.json({ error: 'Missing ids or all=true' }, { status: 400 });
    }
    
    const query = adminDb.collection('events').doc(eventId).collection('uploads');
    const snap = await query.get();
    
    let uploads = [];
    snap.forEach(doc => {
      uploads.push({ id: doc.id, ...doc.data() });
    });
    
    if (!isHost) {
      uploads = uploads.filter(u => u.status === 'approved');
    }
    
    if (idsParam) {
      const requestedIds = new Set(idsParam.split(','));
      uploads = uploads.filter(u => requestedIds.has(u.id));
    }
    
    // Filter out any without drive file IDs
    const downloadable = uploads.filter(u => {
      if (u.fileId) return true;
      if (u.downloadUrl && u.downloadUrl.includes('id=')) return true;
      return false;
    });
    
    if (downloadable.length === 0) {
      return NextResponse.json({ error: 'No files available for download' }, { status: 404 });
    }
    
    // 3. Limit size/files to prevent massive timeouts silently failing
    if (downloadable.length > 200) {
      return NextResponse.json({ 
        error: 'This gallery is too large for a single ZIP download. Try downloading smaller batches.' 
      }, { status: 413 });
    }

    // 4. Stream Drive -> ZIP -> Browser
    const drive = getDriveClient();
    const zip = new JSZip();
    const nameCounts = new Map();
    
    for (const u of downloadable) {
      let fileId = u.fileId;
      if (!fileId && u.downloadUrl) {
        const match = u.downloadUrl.match(/id=([^&]+)/);
        if (match) fileId = match[1];
      }
      
      if (!fileId) continue;
      
      let safeName = u.filename || 'file';
      if (nameCounts.has(safeName)) {
        const count = nameCounts.get(safeName) + 1;
        nameCounts.set(safeName, count);
        const parts = safeName.split('.');
        if (parts.length > 1) {
          const ext = parts.pop();
          safeName = `${parts.join('.')}_${count}.${ext}`;
        } else {
          safeName = `${safeName}_${count}`;
        }
      } else {
        nameCounts.set(safeName, 1);
      }
      
      try {
        const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        zip.file(safeName, res.data);
      } catch (err) {
        console.error(`Failed to fetch Drive file ${fileId} for ZIP:`, err.message);
      }
    }

    const zipStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
    const webStream = nodeStreamToReadableStream(zipStream);

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="vaulty-${eventId}-files.zip"`);
    
    return new Response(webStream, { headers });
  } catch (err) {
    console.error('ZIP streaming error:', err);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }
}
