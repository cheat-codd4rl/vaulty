const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to local app...');
  await page.goto('http://localhost:3000');
  
  // Try to create an event
  try {
    await page.waitForSelector('text=Create a new event', { timeout: 3000 });
    await page.click('text=Create a new event');
    
    // Fill out event creation form
    await page.fill('input[name="name"]', 'Test Event');
    await page.click('button[type="submit"]');
    console.log('Event created.');
  } catch (e) {
    console.log('Already on dashboard or need to login?');
    // If we need to login, just create a new host session
  }

  // Find the guest link
  await page.waitForSelector('#guest-link', { timeout: 10000 });
  const guestLink = await page.inputValue('#guest-link');
  console.log('Found guest link:', guestLink);

  // Close host context and open a fresh one for guest
  await context.close();
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  console.log('Navigating to guest link...', guestLink);
  await guestPage.goto(guestLink);

  // Enter guest name if prompted
  try {
    const nameInput = await guestPage.waitForSelector('input[placeholder="Your name"]', { timeout: 5000 });
    await nameInput.fill('Test Guest');
    await guestPage.click('button:has-text("Continue")');
    console.log('Entered guest name.');
  } catch (e) {
    console.log('No guest name prompt, continuing.');
  }

  console.log('Looking for upload dropzone...');
  const dropzone = await guestPage.waitForSelector('.dropzone');
  
  // Set up file chooser intercept
  const [fileChooser] = await Promise.all([
    guestPage.waitForEvent('filechooser'),
    dropzone.click(),
  ]);

  const testImage = path.resolve('C:/Users/ADMIN/.gemini/antigravity-ide/brain/5013dcab-c53d-4bdb-9986-004f92f2e70e/test_image_1787580349611.jpg');
  console.log('Uploading file:', testImage);
  await fileChooser.setFiles(testImage);

  console.log('Waiting for visual queue to appear...');
  try {
    await guestPage.waitForSelector('.qitem', { timeout: 5000 });
    console.log('✅ Queue item appeared successfully!');
    
    // Wait for it to finish processing
    await guestPage.waitForSelector('.qstate:has-text("done")', { timeout: 15000 });
    console.log('✅ Upload completed successfully!');
  } catch (e) {
    console.error('❌ Failed to upload:', e);
  }

  await browser.close();
})();
