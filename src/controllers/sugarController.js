const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

// Get All Sugar Readings
exports.getSugarReadings = async (req, res) => {
  try {
    const userId = req.user.id;

    const [readings] = await db.query(
      'SELECT id, value, reading_type as type, notes, timestamp FROM sugar_readings WHERE user_id = ? ORDER BY timestamp DESC',
      [userId]
    );

    res.status(200).json({
      success: true,
      readings: readings
    });
  } catch (error) {
    console.error('Get sugar readings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sugar readings.'
    });
  }
};

// Add Sugar Reading
exports.addSugarReading = async (req, res) => {
  try {
    const userId = req.user.id;
    const { value, type, notes, timestamp } = req.body;

    // Validation
    if (!value || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide sugar value and reading type.'
      });
    }

    if (isNaN(value) || value < 0 || value > 600) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid sugar value (0-600).'
      });
    }

    if (!['Fasting', 'Before Meal', 'After Meal', 'Bedtime'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reading type.'
      });
    }

    const readingId = uuidv4();
    const readingTimestamp = timestamp ? new Date(timestamp) : new Date();

    await db.query(
      'INSERT INTO sugar_readings (id, user_id, value, reading_type, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [readingId, userId, value, type, notes || null, readingTimestamp]
    );

    const [newReading] = await db.query(
      'SELECT id, value, reading_type as type, notes, timestamp FROM sugar_readings WHERE id = ?',
      [readingId]
    );

    res.status(201).json({
      success: true,
      message: 'Sugar reading added successfully.',
      reading: newReading[0]
    });
  } catch (error) {
    console.error('Add sugar reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding sugar reading.'
    });
  }
};

// Delete Sugar Reading
exports.deleteSugarReading = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if reading exists and belongs to user
    const [readings] = await db.query(
      'SELECT id FROM sugar_readings WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (readings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sugar reading not found.'
      });
    }

    await db.query('DELETE FROM sugar_readings WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Sugar reading deleted successfully.'
    });
  } catch (error) {
    console.error('Delete sugar reading error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting sugar reading.'
    });
  }
};

// Get Sugar Insights
exports.getSugarInsights = async (req, res) => {
  try {
    const userId = req.user.id;

    const [readings] = await db.query(
      'SELECT value, reading_type, timestamp FROM sugar_readings WHERE user_id = ? ORDER BY timestamp ASC',
      [userId]
    );

    if (readings.length === 0) {
      return res.status(200).json({
        success: true,
        insights: []
      });
    }

    const insights = [];

    // Calculate statistics
    const totalReadings = readings.length;
    const highReadings = readings.filter(r => r.value > 180);
    const lowReadings = readings.filter(r => r.value < 70);
    const normalReadings = readings.filter(r => r.value >= 70 && r.value <= 180);

    const avgReading = readings.reduce((sum, r) => sum + parseFloat(r.value), 0) / totalReadings;

    // High readings insight
    if (highReadings.length > 0) {
      const highPercentage = Math.round((highReadings.length / totalReadings) * 100);
      if (highPercentage > 30) {
        insights.push(`${highPercentage}% of your readings are high. Consider discussing medication adjustments with your doctor.`);
      }
    }

    // Low readings insight
    if (lowReadings.length > 0) {
      insights.push(`You've had ${lowReadings.length} low sugar readings. Be careful and keep glucose tablets handy.`);
    }

    // Average insight
    if (avgReading > 150) {
      insights.push(`Your average sugar level is ${Math.round(avgReading)} mg/dL, which is above normal range. Try to maintain better control.`);
    } else if (avgReading >= 70 && avgReading <= 150) {
      insights.push(`Great job! Your average sugar level of ${Math.round(avgReading)} mg/dL is in the normal range.`);
    }

    // Morning readings insight
    const morningReadings = readings.filter(r => {
      const hour = new Date(r.timestamp).getHours();
      return hour >= 5 && hour < 11;
    });

    if (morningReadings.length >= 3) {
      const avgMorning = morningReadings.reduce((sum, r) => sum + parseFloat(r.value), 0) / morningReadings.length;
      if (avgMorning > 150) {
        insights.push(`Your morning sugar levels tend to be high (${Math.round(avgMorning)} mg/dL on average). This could be due to the dawn phenomenon.`);
      }
    }

    // Improvement trend
    if (totalReadings >= 10) {
      const halfPoint = Math.floor(totalReadings / 2);
      const oldReadings = readings.slice(0, halfPoint);
      const recentReadings = readings.slice(halfPoint);

      const oldAvg = oldReadings.reduce((sum, r) => sum + parseFloat(r.value), 0) / oldReadings.length;
      const recentAvg = recentReadings.reduce((sum, r) => sum + parseFloat(r.value), 0) / recentReadings.length;

      if (recentAvg < oldAvg && (oldAvg - recentAvg) > 15) {
        insights.push(`Excellent progress! Your average has improved from ${Math.round(oldAvg)} to ${Math.round(recentAvg)} mg/dL.`);
      } else if (recentAvg > oldAvg && (recentAvg - oldAvg) > 15) {
        insights.push(`Your sugar levels have increased recently. Consider reviewing your diet and medication with your doctor.`);
      }
    }

    res.status(200).json({
      success: true,
      insights: insights,
      statistics: {
        total: totalReadings,
        high: highReadings.length,
        low: lowReadings.length,
        normal: normalReadings.length,
        average: Math.round(avgReading)
      }
    });
  } catch (error) {
    console.error('Get sugar insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating insights.'
    });
  }
};