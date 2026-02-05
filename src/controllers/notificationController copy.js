// src/controllers/notificationController.js
// Notification Controller for managing push notifications

const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (only once)
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (!firebaseInitialized && !admin.apps.length) {
    try {
      // You need to download your service account key from Firebase Console
      // and set the path in environment variable or use the JSON directly
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log('Firebase Admin initialized successfully');
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault()
        });
        firebaseInitialized = true;
        console.log('Firebase Admin initialized with application default credentials');
      } else {
        console.warn('Firebase Admin not initialized: No credentials provided');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
  return firebaseInitialized;
};

// Initialize on module load
initializeFirebase();

/**
 * Send FCM notification to a specific user
 */
const sendFCMNotification = async (fcmToken, title, body, data = {}) => {
  if (!initializeFirebase()) {
    console.warn('Firebase not initialized, skipping FCM send');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!fcmToken) {
    console.warn('No FCM token provided');
    return { success: false, error: 'No FCM token' };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('FCM notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM send error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all notifications for user
 * @route GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT id, title, body, notification_type as type, data, 
             is_read as isRead, is_sent as isSent, 
             scheduled_at as scheduledAt, sent_at as sentAt, 
             read_at as readAt, created_at as createdAt
      FROM notifications 
      WHERE user_id = ?
    `;
    const params = [userId];

    if (unread_only === 'true') {
      query += ` AND is_read = 0`;
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [notifications] = await db.query(query, params);

    // Get unread count
    const [unreadCount] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    // Parse JSON data field
    const formattedNotifications = notifications.map(n => ({
      ...n,
      isRead: n.isRead === 1,
      isSent: n.isSent === 1,
      data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null
    }));

    res.status(200).json({
      success: true,
      notifications: formattedNotifications,
      unreadCount: unreadCount[0].count
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications.'
    });
  }
};

/**
 * Create and send a notification
 * @route POST /api/notifications
 */
exports.createNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, body, type = 'system', data = {}, send_push = true } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and body.'
      });
    }

    const validTypes = ['reminder', 'sugar_alert', 'foot_health', 'medication', 'system', 'achievement'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type.'
      });
    }

    const notificationId = uuidv4();
    const now = new Date();

    // Insert notification
    await db.query(
      `INSERT INTO notifications 
      (id, user_id, title, body, notification_type, data, is_read, is_sent, sent_at, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        notificationId,
        userId,
        title,
        body,
        type,
        JSON.stringify(data),
        send_push ? 1 : 0,
        send_push ? now : null,
        now
      ]
    );

    // Send FCM notification if requested
    let fcmResult = null;
    if (send_push) {
      const [users] = await db.query('SELECT fcm_token FROM users WHERE id = ?', [userId]);
      if (users.length > 0 && users[0].fcm_token) {
        fcmResult = await sendFCMNotification(users[0].fcm_token, title, body, {
          notification_id: notificationId,
          type,
          ...data
        });
      }
    }

    const [newNotification] = await db.query(
      `SELECT id, title, body, notification_type as type, data, 
              is_read as isRead, is_sent as isSent, created_at as createdAt
       FROM notifications WHERE id = ?`,
      [notificationId]
    );

    res.status(201).json({
      success: true,
      message: 'Notification created successfully.',
      notification: {
        ...newNotification[0],
        isRead: false,
        isSent: send_push,
        data: data
      },
      fcmResult
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating notification.'
    });
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [notifications] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    await db.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification.'
    });
  }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications.'
    });
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [notifications] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (notifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    await db.query('DELETE FROM notifications WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification.'
    });
  }
};

/**
 * Clear all notifications
 * @route DELETE /api/notifications/clear-all
 */
exports.clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query('DELETE FROM notifications WHERE user_id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'All notifications cleared.'
    });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing notifications.'
    });
  }
};

/**
 * Get notification preferences
 * @route GET /api/notifications/preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const [preferences] = await db.query(
      `SELECT 
        reminder_notifications as reminderNotifications,
        sugar_alerts as sugarAlerts,
        foot_health_notifications as footHealthNotifications,
        medication_reminders as medicationReminders,
        system_notifications as systemNotifications,
        achievement_notifications as achievementNotifications,
        quiet_hours_start as quietHoursStart,
        quiet_hours_end as quietHoursEnd,
        quiet_hours_enabled as quietHoursEnabled
      FROM notification_preferences WHERE user_id = ?`,
      [userId]
    );

    if (preferences.length === 0) {
      // Create default preferences
      const prefId = uuidv4();
      await db.query(
        'INSERT INTO notification_preferences (id, user_id) VALUES (?, ?)',
        [prefId, userId]
      );

      return res.status(200).json({
        success: true,
        preferences: {
          reminderNotifications: true,
          sugarAlerts: true,
          footHealthNotifications: true,
          medicationReminders: true,
          systemNotifications: true,
          achievementNotifications: true,
          quietHoursStart: '22:00:00',
          quietHoursEnd: '07:00:00',
          quietHoursEnabled: false
        }
      });
    }

    const prefs = preferences[0];
    res.status(200).json({
      success: true,
      preferences: {
        reminderNotifications: prefs.reminderNotifications === 1,
        sugarAlerts: prefs.sugarAlerts === 1,
        footHealthNotifications: prefs.footHealthNotifications === 1,
        medicationReminders: prefs.medicationReminders === 1,
        systemNotifications: prefs.systemNotifications === 1,
        achievementNotifications: prefs.achievementNotifications === 1,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
        quietHoursEnabled: prefs.quietHoursEnabled === 1
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching preferences.'
    });
  }
};

/**
 * Update notification preferences
 * @route PUT /api/notifications/preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      reminderNotifications,
      sugarAlerts,
      footHealthNotifications,
      medicationReminders,
      systemNotifications,
      achievementNotifications,
      quietHoursStart,
      quietHoursEnd,
      quietHoursEnabled
    } = req.body;

    // Check if preferences exist
    const [existing] = await db.query(
      'SELECT id FROM notification_preferences WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      // Create new preferences
      const prefId = uuidv4();
      await db.query(
        `INSERT INTO notification_preferences 
        (id, user_id, reminder_notifications, sugar_alerts, foot_health_notifications, 
         medication_reminders, system_notifications, achievement_notifications,
         quiet_hours_start, quiet_hours_end, quiet_hours_enabled) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prefId, userId,
          reminderNotifications !== undefined ? (reminderNotifications ? 1 : 0) : 1,
          sugarAlerts !== undefined ? (sugarAlerts ? 1 : 0) : 1,
          footHealthNotifications !== undefined ? (footHealthNotifications ? 1 : 0) : 1,
          medicationReminders !== undefined ? (medicationReminders ? 1 : 0) : 1,
          systemNotifications !== undefined ? (systemNotifications ? 1 : 0) : 1,
          achievementNotifications !== undefined ? (achievementNotifications ? 1 : 0) : 1,
          quietHoursStart || '22:00:00',
          quietHoursEnd || '07:00:00',
          quietHoursEnabled !== undefined ? (quietHoursEnabled ? 1 : 0) : 0
        ]
      );
    } else {
      // Update existing preferences
      const updateFields = [];
      const updateValues = [];

      if (reminderNotifications !== undefined) {
        updateFields.push('reminder_notifications = ?');
        updateValues.push(reminderNotifications ? 1 : 0);
      }
      if (sugarAlerts !== undefined) {
        updateFields.push('sugar_alerts = ?');
        updateValues.push(sugarAlerts ? 1 : 0);
      }
      if (footHealthNotifications !== undefined) {
        updateFields.push('foot_health_notifications = ?');
        updateValues.push(footHealthNotifications ? 1 : 0);
      }
      if (medicationReminders !== undefined) {
        updateFields.push('medication_reminders = ?');
        updateValues.push(medicationReminders ? 1 : 0);
      }
      if (systemNotifications !== undefined) {
        updateFields.push('system_notifications = ?');
        updateValues.push(systemNotifications ? 1 : 0);
      }
      if (achievementNotifications !== undefined) {
        updateFields.push('achievement_notifications = ?');
        updateValues.push(achievementNotifications ? 1 : 0);
      }
      if (quietHoursStart !== undefined) {
        updateFields.push('quiet_hours_start = ?');
        updateValues.push(quietHoursStart);
      }
      if (quietHoursEnd !== undefined) {
        updateFields.push('quiet_hours_end = ?');
        updateValues.push(quietHoursEnd);
      }
      if (quietHoursEnabled !== undefined) {
        updateFields.push('quiet_hours_enabled = ?');
        updateValues.push(quietHoursEnabled ? 1 : 0);
      }

      if (updateFields.length > 0) {
        updateValues.push(userId);
        await db.query(
          `UPDATE notification_preferences SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );
      }
    }

    // Fetch updated preferences
    const [updatedPrefs] = await db.query(
      `SELECT 
        reminder_notifications as reminderNotifications,
        sugar_alerts as sugarAlerts,
        foot_health_notifications as footHealthNotifications,
        medication_reminders as medicationReminders,
        system_notifications as systemNotifications,
        achievement_notifications as achievementNotifications,
        quiet_hours_start as quietHoursStart,
        quiet_hours_end as quietHoursEnd,
        quiet_hours_enabled as quietHoursEnabled
      FROM notification_preferences WHERE user_id = ?`,
      [userId]
    );

    const prefs = updatedPrefs[0];
    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully.',
      preferences: {
        reminderNotifications: prefs.reminderNotifications === 1,
        sugarAlerts: prefs.sugarAlerts === 1,
        footHealthNotifications: prefs.footHealthNotifications === 1,
        medicationReminders: prefs.medicationReminders === 1,
        systemNotifications: prefs.systemNotifications === 1,
        achievementNotifications: prefs.achievementNotifications === 1,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
        quietHoursEnabled: prefs.quietHoursEnabled === 1
      }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences.'
    });
  }
};

/**
 * Send test notification (for testing FCM)
 * @route POST /api/notifications/test
 */
exports.sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's FCM token
    const [users] = await db.query('SELECT fcm_token, name FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const fcmToken = users[0].fcm_token;
    const userName = users[0].name || 'User';

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'No FCM token registered for this user. Please enable notifications in the app.'
      });
    }

    // Create notification in database
    const notificationId = uuidv4();
    const title = 'Test Notification 🔔';
    const body = `Hello ${userName}! This is a test notification from Sehat Saathi.`;

    await db.query(
      `INSERT INTO notifications 
      (id, user_id, title, body, notification_type, data, is_read, is_sent, sent_at, created_at) 
      VALUES (?, ?, ?, ?, 'system', ?, 0, 1, NOW(), NOW())`,
      [notificationId, userId, title, body, JSON.stringify({ test: true })]
    );

    // Send FCM notification
    const fcmResult = await sendFCMNotification(fcmToken, title, body, {
      notification_id: notificationId,
      type: 'system',
      test: 'true'
    });

    res.status(200).json({
      success: true,
      message: 'Test notification sent.',
      fcmResult,
      notificationId
    });
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending test notification.'
    });
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    res.status(200).json({
      success: true,
      unreadCount: result[0].count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count.'
    });
  }
};

// Export the sendFCMNotification function for use in other controllers
exports.sendFCMNotification = sendFCMNotification;