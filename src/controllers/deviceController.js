// src/controllers/deviceController.js
// Device Controller for Bluetooth-based ESP32 data
// Data flow: ESP32 → Bluetooth → Mobile App → HTTP API → Backend

const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

/**
 * Receive device data from mobile app (originally received via Bluetooth from ESP32)
 * @route POST /api/device/data
 */
exports.receiveDeviceData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      device_id,
      patient_id,
      session_id,
      exercise,
      metrics,
      reps,
      battery,
      timestamp
    } = req.body;

    // Validation
    if (!device_id || !session_id || !exercise) {
      return res.status(400).json({
        success: false,
        message: 'Please provide device_id, session_id, and exercise.'
      });
    }

    const recordId = uuidv4();
    const deviceTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Insert the data into database
    await db.query(
      `INSERT INTO device_sessions 
      (id, user_id, device_id, patient_id, session_id, exercise, angle_deg, force_n, velocity, current_reps, target_reps, battery, device_timestamp) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        userId,
        device_id,
        patient_id || null,
        session_id,
        exercise,
        metrics?.angle_deg || null,
        metrics?.force_n || null,
        metrics?.velocity || null,
        reps?.current || 0,
        reps?.target || 0,
        battery || null,
        deviceTimestamp
      ]
    );

    // Update or create device record with last seen timestamp
    await db.query(
      `INSERT INTO user_devices (id, user_id, device_id, last_seen, is_active) 
      VALUES (?, ?, ?, NOW(), 1) 
      ON DUPLICATE KEY UPDATE last_seen = NOW(), is_active = 1`,
      [uuidv4(), userId, device_id]
    );

    // Fetch the newly created record
    const [newRecord] = await db.query(
      `SELECT * FROM device_sessions WHERE id = ?`,
      [recordId]
    );

    res.status(201).json({
      success: true,
      message: 'Device data received successfully.',
      data: newRecord[0]
    });
  } catch (error) {
    console.error('Receive device data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while receiving device data.'
    });
  }
};

/**
 * Get all sessions for user
 * @route GET /api/device/sessions
 */
exports.getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, exercise, limit = 100 } = req.query;

    let query = `SELECT * FROM device_sessions WHERE user_id = ?`;
    const params = [userId];

    if (session_id) {
      query += ` AND session_id = ?`;
      params.push(session_id);
    }

    if (exercise) {
      query += ` AND exercise = ?`;
      params.push(exercise);
    }

    query += ` ORDER BY device_timestamp DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [sessions] = await db.query(query, params);

    res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions.'
    });
  }
};

/**
 * Get latest session data
 * @route GET /api/device/latest
 */
exports.getLatestSessionData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.query;

    let query = `SELECT * FROM device_sessions WHERE user_id = ?`;
    const params = [userId];

    if (session_id) {
      query += ` AND session_id = ?`;
      params.push(session_id);
    }

    query += ` ORDER BY device_timestamp DESC LIMIT 1`;

    const [data] = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: data[0] || null
    });
  } catch (error) {
    console.error('Get latest session data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching latest data.'
    });
  }
};

/**
 * Get session summary/statistics
 * @route GET /api/device/sessions/:session_id/stats
 */
exports.getSessionStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.params;

    const [stats] = await db.query(
      `SELECT 
        session_id,
        exercise,
        device_id,
        COUNT(*) as total_readings,
        MAX(current_reps) as max_reps,
        MAX(target_reps) as target_reps,
        AVG(angle_deg) as avg_angle,
        MAX(angle_deg) as max_angle,
        AVG(force_n) as avg_force,
        MAX(force_n) as max_force,
        AVG(velocity) as avg_velocity,
        MIN(device_timestamp) as session_start,
        MAX(device_timestamp) as session_end,
        MIN(battery) as min_battery
      FROM device_sessions 
      WHERE user_id = ? AND session_id = ?
      GROUP BY session_id, exercise, device_id`,
      [userId, session_id]
    );

    if (stats.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    res.status(200).json({
      success: true,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session stats.'
    });
  }
};

/**
 * Get user's registered Bluetooth devices
 * @route GET /api/device/devices
 */
exports.getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id;

    const [devices] = await db.query(
      `SELECT id, device_id, device_name, is_active, last_seen, created_at 
       FROM user_devices 
       WHERE user_id = ? 
       ORDER BY last_seen DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('Get user devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching devices.'
    });
  }
};

/**
 * Register a new Bluetooth device
 * @route POST /api/device/register
 */
exports.registerDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id, device_name } = req.body;

    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide device_id.'
      });
    }

    const deviceRecordId = uuidv4();

    // Insert or update device
    await db.query(
      `INSERT INTO user_devices (id, user_id, device_id, device_name, last_seen, is_active) 
      VALUES (?, ?, ?, ?, NOW(), 1) 
      ON DUPLICATE KEY UPDATE device_name = COALESCE(?, device_name), last_seen = NOW(), is_active = 1`,
      [deviceRecordId, userId, device_id, device_name || null, device_name]
    );

    // Fetch the device record
    const [device] = await db.query(
      `SELECT * FROM user_devices WHERE user_id = ? AND device_id = ?`,
      [userId, device_id]
    );

    res.status(201).json({
      success: true,
      message: 'Device registered successfully.',
      device: device[0]
    });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while registering device.'
    });
  }
};

/**
 * Update a registered device
 * @route PUT /api/device/devices/:device_id
 */
exports.updateDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id } = req.params;
    const { device_name, is_active } = req.body;

    // Check if device exists
    const [devices] = await db.query(
      'SELECT id FROM user_devices WHERE device_id = ? AND user_id = ?',
      [device_id, userId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (device_name !== undefined) {
      updateFields.push('device_name = ?');
      updateValues.push(device_name);
    }

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length > 0) {
      updateValues.push(device_id);
      updateValues.push(userId);
      await db.query(
        `UPDATE user_devices SET ${updateFields.join(', ')} WHERE device_id = ? AND user_id = ?`,
        updateValues
      );
    }

    // Fetch updated device
    const [updatedDevice] = await db.query(
      `SELECT * FROM user_devices WHERE device_id = ? AND user_id = ?`,
      [device_id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Device updated successfully.',
      device: updatedDevice[0]
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating device.'
    });
  }
};

/**
 * Remove a registered device
 * @route DELETE /api/device/devices/:device_id
 */
exports.removeDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { device_id } = req.params;

    // Check if device exists
    const [devices] = await db.query(
      'SELECT id FROM user_devices WHERE device_id = ? AND user_id = ?',
      [device_id, userId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.'
      });
    }

    // Delete the device
    await db.query(
      'DELETE FROM user_devices WHERE device_id = ? AND user_id = ?',
      [device_id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Device removed successfully.'
    });
  } catch (error) {
    console.error('Remove device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing device.'
    });
  }
};

/**
 * Register or update FCM token for push notifications
 * @route POST /api/device/fcm-token
 */
exports.registerFCMToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fcm_token.'
      });
    }

    // Update user FCM token
    await db.query(
      `UPDATE users SET fcm_token = ? WHERE id = ?`,
      [fcm_token, userId]
    );

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully.'
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while registering FCM token.'
    });
  }
};

/**
 * Delete session data
 * @route DELETE /api/device/sessions/:session_id
 */
exports.deleteSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.params;

    // Check if session exists
    const [sessions] = await db.query(
      'SELECT id FROM device_sessions WHERE session_id = ? AND user_id = ?',
      [session_id, userId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    // Delete all records for this session
    await db.query(
      'DELETE FROM device_sessions WHERE session_id = ? AND user_id = ?',
      [session_id, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully.'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting session.'
    });
  }
};

/**
 * Get session history with aggregated stats
 * @route GET /api/device/history
 */
exports.getSessionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;

    // Get unique sessions with their stats
    const [sessions] = await db.query(
      `SELECT 
        session_id,
        device_id,
        exercise,
        MAX(current_reps) as total_reps,
        MAX(target_reps) as target_reps,
        AVG(angle_deg) as avg_angle,
        MAX(angle_deg) as max_angle,
        AVG(force_n) as avg_force,
        MAX(force_n) as max_force,
        MIN(battery) as battery_end,
        MIN(device_timestamp) as started_at,
        MAX(device_timestamp) as ended_at,
        COUNT(*) as data_points
      FROM device_sessions 
      WHERE user_id = ?
      GROUP BY session_id, device_id, exercise
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const [countResult] = await db.query(
      `SELECT COUNT(DISTINCT session_id) as total FROM device_sessions WHERE user_id = ?`,
      [userId]
    );

    res.status(200).json({
      success: true,
      sessions,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session history.'
    });
  }
};