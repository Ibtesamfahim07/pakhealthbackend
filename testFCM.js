// Test file - Add this to check FCM
// Save as testFCM.js and run: node testFCM.js

const admin = require('firebase-admin');

// Initialize Firebase (use your credentials)
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase initialized');
    } else {
      console.log('❌ FIREBASE_SERVICE_ACCOUNT not found in .env');
    }
  } catch (error) {
    console.error('❌ Firebase init error:', error);
  }
}

// Test function
async function testSendNotification() {
  const testToken = 'YOUR_FCM_TOKEN_HERE'; // Replace with actual FCM token from database
  
  try {
    const message = {
      token: testToken,
      notification: {
        title: 'Test Notification',
        body: 'This is a test from Node.js'
      },
      data: {
        test: 'true'
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    console.error('Full error:', error);
  }
}

testSendNotification();