import { adminDb } from './firebaseAdmin';
import { deleteFromDrive } from './drive';

export async function processEventDeletion(eventId) {
  const eventRef = adminDb.collection('events').doc(eventId);
  const eventDoc = await eventRef.get();

  if (!eventDoc.exists) {
    throw new Error('Event not found');
  }

  const event = eventDoc.data();

  // Establish lease
  if (event.status === 'deleting') {
    const lease = event.deletionLease || 0;
    if (Date.now() < lease) {
      throw new Error('Deletion is already in progress');
    }
  }

  const updates = {
    status: 'deleting',
    lastDeletionAttemptAt: Date.now(),
    deletionAttemptCount: (event.deletionAttemptCount || 0) + 1,
    deletionLease: Date.now() + 5 * 60 * 1000,
    deletionError: null,
  };
  
  if (event.status !== 'deleting') {
    updates.deletionRequestedAt = Date.now();
  }
  
  await eventRef.update(updates);

  try {
    // Clean up Drive folder first
    if (event.driveFolderId) {
      try {
        await deleteFromDrive(event.driveFolderId);
      } catch (err) {
        if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') throw err;
        if (err.code !== 404 && err.status !== 404) {
          console.error('Failed to delete Drive folder:', err);
          throw new Error('Failed to delete media from Google Drive.');
        }
      }
    }

    // Clean up Firestore (uploads subcollection)
    const uploadsSnapshot = await eventRef.collection('uploads').get();
    let batch = adminDb.batch();
    let count = 0;
    
    for (const doc of uploadsSnapshot.docs) {
      batch.delete(doc.ref);
      count++;
      if (count === 490) { // Keep under 500
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }

    // Delete Event document only after cleanup succeeds
    await eventRef.delete();
    return true;

  } catch (err) {
    console.error(`Delete event cleanup failed for ${eventId}:`, err);
    await eventRef.update({
      deletionError: err.message || 'Unknown error',
      deletionLease: 0
    }).catch(e => console.error('Failed to record deletion error:', e));
    throw err;
  }
}
