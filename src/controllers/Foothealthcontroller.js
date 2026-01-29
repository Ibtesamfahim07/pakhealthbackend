const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

// Get All Foot Health Records
exports.getFootHealthRecords = async (req, res) => {
  try {
    const userId = req.user.id;

    const [records] = await db.query(
      'SELECT id, date, steps, rollers, resisted_exercise as resistedExercise, notes FROM foot_health_records WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );

    res.status(200).json({
      success: true,
      records: records
    });
  } catch (error) {
    console.error('Get foot health records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching foot health records.'
    });
  }
};

// Add Foot Health Record
exports.addFootHealthRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, steps, rollers, resistedExercise, notes } = req.body;

    // Validation
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a date.'
      });
    }

    // Validate numbers
    if (steps !== undefined && (isNaN(steps) || steps < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Steps must be a positive number.'
      });
    }

    if (rollers !== undefined && (isNaN(rollers) || rollers < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Rollers must be a positive number.'
      });
    }

    if (resistedExercise !== undefined && (isNaN(resistedExercise) || resistedExercise < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Resisted exercise must be a positive number.'
      });
    }

    // Check if record already exists for this date
    const recordDate = new Date(date).toISOString().split('T')[0];
    const [existingRecords] = await db.query(
      'SELECT id FROM foot_health_records WHERE user_id = ? AND date = ?',
      [userId, recordDate]
    );

    if (existingRecords.length > 0) {
      // Update existing record
      const updateFields = [];
      const updateValues = [];

      if (steps !== undefined) {
        updateFields.push('steps = steps + ?');
        updateValues.push(steps);
      }
      if (rollers !== undefined) {
        updateFields.push('rollers = rollers + ?');
        updateValues.push(rollers);
      }
      if (resistedExercise !== undefined) {
        updateFields.push('resisted_exercise = resisted_exercise + ?');
        updateValues.push(resistedExercise);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(notes);
      }

      if (updateFields.length > 0) {
        updateValues.push(existingRecords[0].id);
        await db.query(
          `UPDATE foot_health_records SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      const [updatedRecord] = await db.query(
        'SELECT id, date, steps, rollers, resisted_exercise as resistedExercise, notes FROM foot_health_records WHERE id = ?',
        [existingRecords[0].id]
      );

      return res.status(200).json({
        success: true,
        message: 'Foot health record updated successfully.',
        record: updatedRecord[0]
      });
    }

    // Create new record
    const recordId = uuidv4();

    await db.query(
      'INSERT INTO foot_health_records (id, user_id, date, steps, rollers, resisted_exercise, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        recordId,
        userId,
        recordDate,
        steps || 0,
        rollers || 0,
        resistedExercise || 0,
        notes || null
      ]
    );

    const [newRecord] = await db.query(
      'SELECT id, date, steps, rollers, resisted_exercise as resistedExercise, notes FROM foot_health_records WHERE id = ?',
      [recordId]
    );

    res.status(201).json({
      success: true,
      message: 'Foot health record added successfully.',
      record: newRecord[0]
    });
  } catch (error) {
    console.error('Add foot health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding foot health record.'
    });
  }
};

// Update Foot Health Record
exports.updateFootHealthRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { steps, rollers, resistedExercise, notes } = req.body;

    // Check if record exists and belongs to user
    const [records] = await db.query(
      'SELECT id FROM foot_health_records WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Foot health record not found.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (steps !== undefined) {
      if (isNaN(steps) || steps < 0) {
        return res.status(400).json({
          success: false,
          message: 'Steps must be a positive number.'
        });
      }
      updateFields.push('steps = ?');
      updateValues.push(steps);
    }

    if (rollers !== undefined) {
      if (isNaN(rollers) || rollers < 0) {
        return res.status(400).json({
          success: false,
          message: 'Rollers must be a positive number.'
        });
      }
      updateFields.push('rollers = ?');
      updateValues.push(rollers);
    }

    if (resistedExercise !== undefined) {
      if (isNaN(resistedExercise) || resistedExercise < 0) {
        return res.status(400).json({
          success: false,
          message: 'Resisted exercise must be a positive number.'
        });
      }
      updateFields.push('resisted_exercise = ?');
      updateValues.push(resistedExercise);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await db.query(
        `UPDATE foot_health_records SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    const [updatedRecord] = await db.query(
      'SELECT id, date, steps, rollers, resisted_exercise as resistedExercise, notes FROM foot_health_records WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Foot health record updated successfully.',
      record: updatedRecord[0]
    });
  } catch (error) {
    console.error('Update foot health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating foot health record.'
    });
  }
};

// Delete Foot Health Record
exports.deleteFootHealthRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if record exists and belongs to user
    const [records] = await db.query(
      'SELECT id FROM foot_health_records WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Foot health record not found.'
      });
    }

    await db.query('DELETE FROM foot_health_records WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Foot health record deleted successfully.'
    });
  } catch (error) {
    console.error('Delete foot health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting foot health record.'
    });
  }
};

// Get Foot Health Statistics
exports.getFootHealthStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.query; // 'today', 'week', 'month'

    let dateCondition = '';
    const today = new Date().toISOString().split('T')[0];

    switch (period) {
      case 'today':
        dateCondition = `date = '${today}'`;
        break;
      case 'week':
        dateCondition = `date >= DATE_SUB('${today}', INTERVAL 7 DAY)`;
        break;
      case 'month':
        dateCondition = `date >= DATE_SUB('${today}', INTERVAL 30 DAY)`;
        break;
      default:
        dateCondition = '1=1'; // All time
    }

    const [stats] = await db.query(
      `SELECT 
        SUM(steps) as totalSteps,
        SUM(rollers) as totalRollers,
        SUM(resisted_exercise) as totalResistedExercise,
        AVG(steps) as avgSteps,
        AVG(rollers) as avgRollers,
        AVG(resisted_exercise) as avgResistedExercise,
        COUNT(*) as totalDays
      FROM foot_health_records 
      WHERE user_id = ? AND ${dateCondition}`,
      [userId]
    );

    res.status(200).json({
      success: true,
      statistics: {
        totalSteps: stats[0].totalSteps || 0,
        totalRollers: stats[0].totalRollers || 0,
        totalResistedExercise: stats[0].totalResistedExercise || 0,
        avgSteps: Math.round(stats[0].avgSteps) || 0,
        avgRollers: Math.round(stats[0].avgRollers) || 0,
        avgResistedExercise: Math.round(stats[0].avgResistedExercise) || 0,
        totalDays: stats[0].totalDays || 0
      }
    });
  } catch (error) {
    console.error('Get foot health stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics.'
    });
  }
};