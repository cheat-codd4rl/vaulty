require('dotenv').config({ path: '.env.local' });
const { put } = require('@vercel/blob');
const fs = require('fs');

async function testBlob() {
  try {
    const file = fs.readFileSync('large_video.mp4');
    const { url } = await put('test_large_video.mp4', file, { access: 'public' });
    console.log("SUCCESS! Blob URL:", url);
  } catch (err) {
    console.error("FAIL:", err.message);
  }
}
testBlob();
