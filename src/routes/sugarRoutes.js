const express = require('express');
const router = express.Router();
const sugarController = require('../controllers/Sugarcontroller');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// @route   GET /api/sugar
// @desc    Get all sugar readings
// @access  Private
router.get('/', sugarController.getSugarReadings);

// @route   POST /api/sugar
// @desc    Add sugar reading
// @access  Private
router.post('/', sugarController.addSugarReading);

// @route   DELETE /api/sugar/:id
// @desc    Delete sugar reading
// @access  Private
router.delete('/:id', sugarController.deleteSugarReading);

// @route   GET /api/sugar/insights
// @desc    Get sugar insights and statistics
// @access  Private
router.get('/insights', sugarController.getSugarInsights);

module.exports = router;