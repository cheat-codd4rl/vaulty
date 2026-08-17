const { test, expect } = require('@playwright/test');
const path = require('path');

test('Large File Upload verification', async ({ page }) => {
  // Go to the guest page of the test event created by the subagent earlier
  await page.goto('http://localhost:3000/e/evt_msx3pzv7iviz0');
  
  // Wait for the event dashboard to load (checking for dropzone)
  await expect(page.locator('.dropzone')).toBeVisible();

  await page.waitForTimeout(2000); // Wait for React hydration

  // 3. Set the large video file to the file input
  const fileInput = page.locator('input[type="file"]');
  const filePath = path.join(__dirname, 'large_video.mp4');
  await fileInput.setInputFiles(filePath);
  
  // 4. Verify progress starts and reaches 100%, and status is done/awaiting review
  const queueItem = page.locator('.qitem').first();
  await expect(queueItem).toBeVisible({ timeout: 15000 });
  
  // Check that the state eventually reads 'done' or 'awaiting review'
  const stateElement = page.locator('.qstate').first();
  await expect(stateElement).toHaveText(/done|awaiting review/, { timeout: 30000 });
  
  console.log("Upload successful! State:", await stateElement.textContent());
});
