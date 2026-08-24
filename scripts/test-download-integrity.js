const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const JSZip = require('jszip');

async function runTest() {
  console.log('--- Download Integrity Test ---');
  
  // 1. Create a dummy file
  const testFileName = `test_integrity_${Date.now()}.jpg`;
  const testFilePath = path.join(__dirname, testFileName);
  
  // Generate a random 500KB "image" (just random bytes for the test)
  const randomBytes = crypto.randomBytes(500 * 1024);
  fs.writeFileSync(testFilePath, randomBytes);
  
  const originalHash = crypto.createHash('sha256').update(randomBytes).digest('hex');
  console.log(`Original file SHA-256: ${originalHash}`);
  
  // We'll instruct the user on how to use Playwright or manual testing
  // since a fully automated script requires the frontend flow to upload to Vercel Blob
  // and then Firebase approval. 
  
  console.log('\nTo verify this manually:');
  console.log(`1. Upload ${testFileName} via the Vaulty UI`);
  console.log(`2. Approve the upload if moderation is on`);
  console.log(`3. Click "Download all (.zip)" or download the specific file`);
  console.log(`4. Extract the ZIP and run:`);
  console.log(`   certutil -hashfile "path/to/extracted/${testFileName}" SHA256 (Windows)`);
  console.log(`   shasum -a 256 "path/to/extracted/${testFileName}" (Mac/Linux)`);
  console.log(`5. Ensure the hash matches: ${originalHash}`);
  
  // Cleanup
  // fs.unlinkSync(testFilePath);
}

runTest().catch(console.error);
