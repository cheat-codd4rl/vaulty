# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: check_size.spec.js >> Check upload size
- Location: check_size.spec.js:6:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "filechooser"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - link "Vaulty home" [ref=e3] [cursor=pointer]:
      - /url: /
      - img "Vaulty icon" [ref=e4]
      - generic [ref=e5]:
        - text: Vault
        - emphasis [ref=e6]: "y"
    - button "Toggle theme" [ref=e8] [cursor=pointer]
  - generic [ref=e16]:
    - generic [ref=e17]:
      - heading "Welcome!" [level=2] [ref=e18]
      - paragraph [ref=e19]: What should we call you in the gallery?
    - textbox "Your name" [active] [ref=e20]
    - button "Continue" [disabled] [ref=e21]
  - generic [ref=e23]:
    - generic [ref=e24]: Date not set
    - heading "Test Event" [level=1] [ref=e25]
  - generic [ref=e26]:
    - generic [ref=e27] [cursor=pointer]:
      - generic [ref=e28]: ＋
      - heading "Add photos or a short video" [level=3] [ref=e29]
      - paragraph [ref=e30]: Drag files here, or tap to choose from your camera roll. HEIC and MOV are welcome.
      - button "＋ Add photos or a short video Drag files here, or tap to choose from your camera roll. HEIC and MOV are welcome." [ref=e31]
    - generic [ref=e32]:
      - heading "Gallery" [level=2] [ref=e34]
      - button "Download all (.zip)" [ref=e36] [cursor=pointer]
    - generic [ref=e37]:
      - button "All (0)" [ref=e38] [cursor=pointer]
      - button "Pro Shots (0)" [ref=e39] [cursor=pointer]
      - button "Guest Uploads (0)" [ref=e40] [cursor=pointer]
      - button "My uploads (0)" [ref=e41] [cursor=pointer]
    - generic [ref=e42]:
      - heading "No photos in this tab yet" [level=3] [ref=e43]
      - paragraph [ref=e44]: Be the first to add one above.
  - contentinfo [ref=e45]:
    - generic [ref=e46]:
      - paragraph [ref=e47]: Vaulty © 2026
      - generic [ref=e48]:
        - link "Terms of Service" [ref=e49] [cursor=pointer]:
          - /url: /terms
        - link "Privacy Policy" [ref=e50] [cursor=pointer]:
          - /url: /privacy
  - button "Open Next.js Dev Tools" [ref=e56] [cursor=pointer]
  - alert [ref=e60]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { getFirestore } = require('firebase-admin/firestore');
  3  | const fs = require('fs');
  4  | const path = require('path');
  5  | 
  6  | test('Check upload size', async ({ page }) => {
  7  |   const serviceAccount = require('./service-account.json');
  8  |   const { initializeApp, getApps, cert } = require('firebase-admin/app');
  9  |   if (!getApps().length) {
  10 |     initializeApp({ credential: cert(serviceAccount) });
  11 |   }
  12 | 
  13 |   const eventId = 'evt_msx3pzv7iviz0';
  14 | 
  15 |   // Create a dummy file of exactly 508,000 bytes
  16 |   const dummyPath = path.join(__dirname, 'dummy508.jpg');
  17 |   const buffer = Buffer.alloc(508000, 'A');
  18 |   fs.writeFileSync(dummyPath, buffer);
  19 | 
  20 |   await page.goto(`http://localhost:3000/e/${eventId}`);
  21 | 
  22 |   // Disable moderation and PIN
  23 |   await getFirestore().collection('events').doc(eventId).update({
  24 |     guestPin: '',
  25 |     moderationMode: 'none',
  26 |     'settings.requirePin': false
  27 |   });
  28 | 
  29 |   // Clear existing uploads
  30 |   const snapshot = await getFirestore().collection('events').doc(eventId).collection('uploads').get();
  31 |   const batch = getFirestore().batch();
  32 |   snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  33 |   await batch.commit();
  34 | 
  35 |   console.log('Cleared uploads. Uploading 508,000 bytes...');
  36 |   
  37 |   // Create FileChooser
> 38 |   const fileChooserPromise = page.waitForEvent('filechooser');
     |                                   ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  39 |   await page.locator('.upload-prompt').click();
  40 |   const fileChooser = await fileChooserPromise;
  41 |   await fileChooser.setFiles(dummyPath);
  42 | 
  43 |   // Wait for upload to complete (thumbnail appears)
  44 |   await page.locator('.photo').first().waitFor({ state: 'visible', timeout: 30000 });
  45 |   
  46 |   console.log('Upload completed in UI. Checking Firestore...');
  47 | 
  48 |   // Check Firestore
  49 |   const uploadsSnap = await getFirestore().collection('events').doc(eventId).collection('uploads').get();
  50 |   expect(uploadsSnap.docs.length).toBe(1);
  51 |   const doc = uploadsSnap.docs[0].data();
  52 |   
  53 |   console.log('Firestore recorded size:', doc.size);
  54 |   
  55 |   // Check the actual blob by downloading it
  56 |   const res = await page.request.get(doc.downloadUrl);
  57 |   const data = await res.body();
  58 |   console.log('Downloaded raw from Drive size:', data.length);
  59 | });
  60 | 
```