// src/routes/deviceRoutes.js
// Device Routes for Bluetooth-based ESP32 data

const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/device/data
 * @desc    Receive device data from mobile app (via Bluetooth from ESP32)
 * @access  Private
 */
router.post('/data', deviceController.receiveDeviceData);

/**
 * @route   GET /api/device/sessions
 * @desc    Get all sessions
 * @access  Private
 */
router.get('/sessions', deviceController.getSessions);

/**
 * @route   GET /api/device/latest
 * @desc    Get latest session data
 * @access  Private
 */
router.get('/latest', deviceController.getLatestSessionData);

/**
 * @route   GET /api/device/history
 * @desc    Get session history with aggregated stats
 * @access  Private
 */
router.get('/history', deviceController.getSessionHistory);

/**
 * @route   GET /api/device/sessions/:session_id/stats
 * @desc    Get session statistics
 * @access  Private
 */
router.get('/sessions/:session_id/stats', deviceController.getSessionStats);

/**
 * @route   DELETE /api/device/sessions/:session_id
 * @desc    Delete a session
 * @access  Private
 */
router.delete('/sessions/:session_id', deviceController.deleteSession);

/**
 * @route   GET /api/device/devices
 * @desc    Get user's registered Bluetooth devices
 * @access  Private
 */
router.get('/devices', deviceController.getUserDevices);

/**
 * @route   POST /api/device/register
 * @desc    Register a new Bluetooth device
 * @access  Private
 */
router.post('/register', deviceController.registerDevice);

/**
 * @route   PUT /api/device/devices/:device_id
 * @desc    Update a registered device
 * @access  Private
 */
router.put('/devices/:device_id', deviceController.updateDevice);

/**
 * @route   DELETE /api/device/devices/:device_id
 * @desc    Remove a registered device
 * @access  Private
 */
router.delete('/devices/:device_id', deviceController.removeDevice);

/**
 * @route   POST /api/device/fcm-token
 * @desc    Register or update FCM token for push notifications
 * @access  Private
 */
router.post('/fcm-token', deviceController.registerFCMToken);

module.exports = router;