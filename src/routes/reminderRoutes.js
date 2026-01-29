const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/Remindercontroller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/reminders
// @desc    Get all reminders
// @access  Private
router.get('/', reminderController.getReminders);

// @route   POST /api/reminders
// @desc    Add reminder
// @access  Private
router.post('/', reminderController.addReminder);

// @route   PUT /api/reminders/:id
// @desc    Update reminder
// @access  Private
router.put('/:id', reminderController.updateReminder);

// @route   PATCH /api/reminders/:id/toggle
// @desc    Toggle reminder active status
// @access  Private
router.patch('/:id/toggle', reminderController.toggleReminder);

// @route   DELETE /api/reminders/:id
// @desc    Delete reminder
// @access  Private
router.delete('/:id', reminderController.deleteReminder);

module.exports = router;