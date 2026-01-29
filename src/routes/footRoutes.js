const express = require('express');
const router = express.Router();
const footHealthController = require('../controllers/Foothealthcontroller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/foot-health
// @desc    Get all foot health records
// @access  Private
router.get('/', footHealthController.getFootHealthRecords);

// @route   POST /api/foot-health
// @desc    Add foot health record
// @access  Private
router.post('/', footHealthController.addFootHealthRecord);

// @route   PUT /api/foot-health/:id
// @desc    Update foot health record
// @access  Private
router.put('/:id', footHealthController.updateFootHealthRecord);

// @route   DELETE /api/foot-health/:id
// @desc    Delete foot health record
// @access  Private
router.delete('/:id', footHealthController.deleteFootHealthRecord);

// @route   GET /api/foot-health/stats
// @desc    Get foot health statistics
// @access  Private
router.get('/stats', footHealthController.getFootHealthStats);

module.exports = router;