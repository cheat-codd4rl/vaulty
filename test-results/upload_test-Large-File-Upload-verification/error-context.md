# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upload_test.spec.js >> Large File Upload verification
- Location: upload_test.spec.js:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.qitem').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('.qitem').first()

```

```yaml
- link "Vaulty home":
  - /url: /
  - img "Vaulty icon"
  - text: Vault
  - emphasis: "y"
- button "Toggle theme":
  - img
- link "Create event":
  - /url: /host
- text: Date not set
- heading "Test Event" [level=1]
- text: ＋
- heading "Add photos or a short video" [level=3]
- paragraph: Drag files here, or tap to choose from your camera roll. HEIC and MOV are welcome.
- heading "Gallery" [level=2]
- button "Download all (.zip)"
- button "All (0)"
- button "Pro Shots (0)"
- button "Guest Uploads (0)"
- button "My uploads (0)"
- heading "No photos in this tab yet" [level=3]
- paragraph: Be the first to add one above.
- contentinfo:
  - paragraph: Vaulty — your photos are processed locally and stored in your browser. Connect Firebase to enable permanent cloud storage and real-time sync.
  - group: Architecture notes
- alert
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const path = require('path');
  3  | 
  4  | test('Large File Upload verification', async ({ page }) => {
  5  |   // Go to the guest page of the test event created by the subagent earlier
  6  |   await page.goto('http://localhost:3000/e/evt_msx3pzv7iviz0');
  7  |   
  8  |   // Wait for the event dashboard to load (checking for dropzone)
  9  |   await expect(page.locator('.dropzone')).toBeVisible();
  10 | 
  11 |   await page.waitForTimeout(2000); // Wait for React hydration
  12 | 
  13 |   // 3. Set the large video file to the file input
  14 |   const fileInput = page.locator('input[type="file"]');
  15 |   const filePath = path.join(__dirname, 'large_video.mp4');
  16 |   await fileInput.setInputFiles(filePath);
  17 |   
  18 |   // 4. Verify progress starts and reaches 100%, and status is done/awaiting review
  19 |   const queueItem = page.locator('.qitem').first();
> 20 |   await expect(queueItem).toBeVisible({ timeout: 15000 });
     |                           ^ Error: expect(locator).toBeVisible() failed
  21 |   
  22 |   // Check that the state eventually reads 'done' or 'awaiting review'
  23 |   const stateElement = page.locator('.qstate').first();
  24 |   await expect(stateElement).toHaveText(/done|awaiting review/, { timeout: 30000 });
  25 |   
  26 |   console.log("Upload successful! State:", await stateElement.textContent());
  27 | });
  28 | 
```