const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');

// Load service account (assumes running from root of project)
const serviceAccount = require('../service-account.json');

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function migrate() {
  console.log('Starting PIN migration...');
  const eventsSnap = await db.collection('events').get();
  
  let migratedCount = 0;

  for (const doc of eventsSnap.docs) {
    const event = doc.data();
    
    // Check if the event has a plaintext PIN in the public document
    if (event.pin) {
      console.log(`Migrating event: ${event.id}`);
      
      const rawPin = String(Math.floor(100000 + Math.random() * 900000));
      const pinHash = await bcrypt.hash(rawPin, 10);
      
      const batch = db.batch();
      const eventRef = db.collection('events').doc(event.id);
      
      // Remove plaintext pin from public doc, set hasPin
      batch.update(eventRef, {
        pin: require('firebase-admin/firestore').FieldValue.delete(),
        hasPin: true,
        pinUpgraded: true // flag to show alert in host dashboard
      });
      
      const privateRef = eventRef.collection('security').doc('private');
      const privateDoc = await privateRef.get();
      
      if (privateDoc.exists) {
        batch.update(privateRef, {
          pin: require('firebase-admin/firestore').FieldValue.delete(),
          pinHash,
          // Generate inviteToken if missing
          inviteToken: privateDoc.data().inviteToken || require('crypto').randomBytes(16).toString('hex')
        });
      } else {
        batch.set(privateRef, {
          pinHash,
          inviteToken: require('crypto').randomBytes(16).toString('hex')
        }, { merge: true });
      }
      
      await batch.commit();
      migratedCount++;
    } else if (event.accessMode === 'open') {
      // Ensure open events also have an inviteToken generated for the new landing page
      const privateRef = db.collection('events').doc(event.id).collection('security').doc('private');
      const privateDoc = await privateRef.get();
      if (!privateDoc.exists || !privateDoc.data().inviteToken) {
        await privateRef.set({
          inviteToken: require('crypto').randomBytes(16).toString('hex')
        }, { merge: true });
        console.log(`Generated inviteToken for open event: ${event.id}`);
      }
    }
  }
  
  console.log(`Migration complete. Upgraded ${migratedCount} events with new 6-digit PINs.`);
}

migrate().catch(console.error);
