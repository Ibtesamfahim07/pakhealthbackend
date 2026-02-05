// src/services/reminderScheduler.js
const cron = require('node-cron');
const db = require('../../config/database');
const { sendFCMNotification } = require('../controllers/notificationController');
const { v4: uuidv4 } = require('uuid');

// Get current day name
const getDayName = (dayNumber) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayNumber];
};

// Check and send reminder notifications
const checkReminders = async () => {
  try {
    const now = new Date();
    const currentDay = getDayName(now.getDay());
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':00';
    
    // Calculate time 15 minutes from now
    const time15Min = new Date(now.getTime() + 15 * 60000);
    const time15MinStr = time15Min.getHours().toString().padStart(2, '0') + ':' + time15Min.getMinutes().toString().padStart(2, '0') + ':00';

    // Calculate time 10 minutes from now
    const time10Min = new Date(now.getTime() + 10 * 60000);
    const time10MinStr = time10Min.getHours().toString().padStart(2, '0') + ':' + time10Min.getMinutes().toString().padStart(2, '0') + ':00';

    console.log(`⏰ Checking reminders - Current: ${currentTime}, Day: ${currentDay}`);
    console.log(`   15-min: ${time15MinStr}, 10-min: ${time10MinStr}, Exact: ${currentTime}`);

    // Get reminders for 15 minutes advance
    const [reminders15] = await db.query(
      `SELECT r.*, u.fcm_token, u.name as user_name
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       WHERE r.is_active = 1 
       AND r.${currentDay} = 1
       AND TIME(r.time) = TIME(?)`,
      [time15MinStr]
    );

    console.log(`   Found ${reminders15.length} reminders for 15-min advance`);

    // Send 15-minute advance notifications
    for (const reminder of reminders15) {
      console.log(`   Reminder: ${reminder.title}, User: ${reminder.user_name}, FCM Token: ${reminder.fcm_token ? 'EXISTS' : 'MISSING'}`);
      
      if (reminder.fcm_token) {
        const title = `${reminder.reminder_type} Reminder`;
        const body = `15 minutes remaining to ${reminder.title}${reminder.notes ? '\n' + reminder.notes : ''}`;
        
        const notificationId = uuidv4();
        await db.query(
          `INSERT INTO notifications (id, user_id, title, body, notification_type, is_sent, sent_at, created_at) 
           VALUES (?, ?, ?, ?, 'reminder', 1, NOW(), NOW())`,
          [notificationId, reminder.user_id, title, body]
        );
        console.log(`   💾 Notification saved to database`);

        const fcmResult = await sendFCMNotification(reminder.fcm_token, title, body, {
          reminder_id: reminder.id,
          type: 'reminder',
          minutes_before: '15'
        });
        
        console.log(`   📱 FCM Result:`, fcmResult);

        if (fcmResult && fcmResult.success) {
          console.log(`   ✅ Sent 15-min reminder to ${reminder.user_name}: ${reminder.title}`);
        } else {
          console.log(`   ❌ Failed to send FCM to ${reminder.user_name}:`, fcmResult ? fcmResult.error : 'No response');
        }
      } else {
        console.log(`   ⚠️  No FCM token for ${reminder.user_name} - notification saved to DB only`);
      }
    }

    // Get reminders for 10 minutes advance
    const [reminders10] = await db.query(
      `SELECT r.*, u.fcm_token, u.name as user_name
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       WHERE r.is_active = 1 
       AND r.${currentDay} = 1
       AND TIME(r.time) = TIME(?)`,
      [time10MinStr]
    );

    console.log(`   Found ${reminders10.length} reminders for 10-min advance`);

    // Send 10-minute advance notifications
    for (const reminder of reminders10) {
      console.log(`   Reminder: ${reminder.title}, User: ${reminder.user_name}, FCM Token: ${reminder.fcm_token ? 'EXISTS' : 'MISSING'}`);
      
      if (reminder.fcm_token) {
        const title = `${reminder.reminder_type} Reminder`;
        const body = `10 minutes remaining to ${reminder.title}${reminder.notes ? '\n' + reminder.notes : ''}`;
        
        const notificationId = uuidv4();
        await db.query(
          `INSERT INTO notifications (id, user_id, title, body, notification_type, is_sent, sent_at, created_at) 
           VALUES (?, ?, ?, ?, 'reminder', 1, NOW(), NOW())`,
          [notificationId, reminder.user_id, title, body]
        );
        console.log(`   💾 Notification saved to database`);

        const fcmResult = await sendFCMNotification(reminder.fcm_token, title, body, {
          reminder_id: reminder.id,
          type: 'reminder',
          minutes_before: '10'
        });
        
        console.log(`   📱 FCM Result:`, fcmResult);

        if (fcmResult && fcmResult.success) {
          console.log(`   ✅ Sent 10-min reminder to ${reminder.user_name}: ${reminder.title}`);
        } else {
          console.log(`   ❌ Failed to send FCM to ${reminder.user_name}:`, fcmResult ? fcmResult.error : 'No response');
        }
      } else {
        console.log(`   ⚠️  No FCM token for ${reminder.user_name} - notification saved to DB only`);
      }
    }

    // Get reminders for EXACT TIME (RIGHT NOW)
    const [exactReminders] = await db.query(
      `SELECT r.*, u.fcm_token, u.name as user_name
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       WHERE r.is_active = 1 
       AND r.${currentDay} = 1
       AND TIME(r.time) = TIME(?)`,
      [currentTime]
    );

    console.log(`   Found ${exactReminders.length} reminders for EXACT TIME`);

    // Send EXACT TIME notifications
    for (const reminder of exactReminders) {
      console.log(`   Reminder: ${reminder.title}, User: ${reminder.user_name}, FCM Token: ${reminder.fcm_token ? 'EXISTS' : 'MISSING'}`);
      
      if (reminder.fcm_token) {
        const title = `${reminder.reminder_type} Reminder`;
        const body = `Time for ${reminder.title}!${reminder.notes ? '\n' + reminder.notes : ''}`;
        
        const notificationId = uuidv4();
        await db.query(
          `INSERT INTO notifications (id, user_id, title, body, notification_type, is_sent, sent_at, created_at) 
           VALUES (?, ?, ?, ?, 'reminder', 1, NOW(), NOW())`,
          [notificationId, reminder.user_id, title, body]
        );
        console.log(`   💾 Notification saved to database`);

        const fcmResult = await sendFCMNotification(reminder.fcm_token, title, body, {
          reminder_id: reminder.id,
          type: 'reminder',
          minutes_before: '0'
        });
        
        console.log(`   📱 FCM Result:`, fcmResult);

        if (fcmResult && fcmResult.success) {
          console.log(`   🔔 Sent EXACT TIME reminder to ${reminder.user_name}: ${reminder.title}`);
        } else {
          console.log(`   ❌ Failed to send FCM to ${reminder.user_name}:`, fcmResult ? fcmResult.error : 'No response');
        }
      } else {
        console.log(`   ⚠️  No FCM token for ${reminder.user_name} - notification saved to DB only`);
      }
    }

  } catch (error) {
    console.error('Error checking reminders:', error);
  }
};

// Start the scheduler
const startScheduler = () => {
  console.log('🔔 Reminder scheduler started');
  
  // Run every minute
  cron.schedule('* * * * *', checkReminders);
  
  // Run once on startup
  checkReminders();
};

module.exports = { startScheduler, checkReminders };