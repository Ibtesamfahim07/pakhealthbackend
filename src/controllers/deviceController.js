    const { v4: uuidv4 } = require('uuid');
    const db = require('../../config/database');

    // Receive data from ESP32 device
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

        // Update device last seen
        await db.query(
        `INSERT INTO user_devices (id, user_id, device_id, last_seen) 
        VALUES (?, ?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE last_seen = NOW()`,
        [uuidv4(), userId, device_id]
        );

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

    // Get all sessions for user
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

    // Get latest session data (for real-time display)
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

    // Get session summary/statistics
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

    // Get user's registered devices
    exports.getUserDevices = async (req, res) => {
    try {
        const userId = req.user.id;

        const [devices] = await db.query(
        `SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_seen DESC`,
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

    // Register a new device
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

        await db.query(
        `INSERT INTO user_devices (id, user_id, device_id, device_name, last_seen) 
        VALUES (?, ?, ?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE device_name = ?, last_seen = NOW()`,
        [deviceRecordId, userId, device_id, device_name || null, device_name || null]
        );

        const [device] = await db.query(
        `SELECT * FROM user_devices WHERE device_id = ?`,
        [device_id]
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

    // Register or update FCM token
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

    // Delete session data
    exports.deleteSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { session_id } = req.params;

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