const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

// Get All Reminders
exports.getReminders = async (req, res) => {
  try {
    const userId = req.user.id;

    const [reminders] = await db.query(
      `SELECT 
        id, title, reminder_type as type, time, 
        monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        notes, is_active as isActive, created_at as createdAt
      FROM reminders 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [userId]
    );

    // Convert boolean fields
    const formattedReminders = reminders.map(reminder => ({
      ...reminder,
      days: {
        monday: reminder.monday === 1,
        tuesday: reminder.tuesday === 1,
        wednesday: reminder.wednesday === 1,
        thursday: reminder.thursday === 1,
        friday: reminder.friday === 1,
        saturday: reminder.saturday === 1,
        sunday: reminder.sunday === 1
      },
      isActive: reminder.isActive === 1,
      monday: undefined,
      tuesday: undefined,
      wednesday: undefined,
      thursday: undefined,
      friday: undefined,
      saturday: undefined,
      sunday: undefined
    }));

    res.status(200).json({
      success: true,
      reminders: formattedReminders
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reminders.'
    });
  }
};

// Add Reminder
exports.addReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, type, time, days, notes } = req.body;

    // Validation
    if (!title || !type || !time) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, type, and time.'
      });
    }

    if (!['Medication', 'Foot Check', 'Sugar Check', 'Doctor Visit', 'Other'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder type.'
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:MM format.'
      });
    }

    const reminderId = uuidv4();
    const dayValues = days || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    };

    await db.query(
      `INSERT INTO reminders 
      (id, user_id, title, reminder_type, time, monday, tuesday, wednesday, thursday, friday, saturday, sunday, notes, is_active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reminderId,
        userId,
        title,
        type,
        time,
        dayValues.monday ? 1 : 0,
        dayValues.tuesday ? 1 : 0,
        dayValues.wednesday ? 1 : 0,
        dayValues.thursday ? 1 : 0,
        dayValues.friday ? 1 : 0,
        dayValues.saturday ? 1 : 0,
        dayValues.sunday ? 1 : 0,
        notes || null,
        1
      ]
    );

    const [newReminder] = await db.query(
      `SELECT 
        id, title, reminder_type as type, time, 
        monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        notes, is_active as isActive, created_at as createdAt
      FROM reminders 
      WHERE id = ?`,
      [reminderId]
    );

    const formattedReminder = {
      ...newReminder[0],
      days: {
        monday: newReminder[0].monday === 1,
        tuesday: newReminder[0].tuesday === 1,
        wednesday: newReminder[0].wednesday === 1,
        thursday: newReminder[0].thursday === 1,
        friday: newReminder[0].friday === 1,
        saturday: newReminder[0].saturday === 1,
        sunday: newReminder[0].sunday === 1
      },
      isActive: newReminder[0].isActive === 1,
      monday: undefined,
      tuesday: undefined,
      wednesday: undefined,
      thursday: undefined,
      friday: undefined,
      saturday: undefined,
      sunday: undefined
    };

    res.status(201).json({
      success: true,
      message: 'Reminder added successfully.',
      reminder: formattedReminder
    });
  } catch (error) {
    console.error('Add reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding reminder.'
    });
  }
};

// Update Reminder
exports.updateReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, type, time, days, notes, isActive } = req.body;

    // Check if reminder exists and belongs to user
    const [reminders] = await db.query(
      'SELECT id FROM reminders WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (reminders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (type !== undefined) {
      if (!['Medication', 'Foot Check', 'Sugar Check', 'Doctor Visit', 'Other'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reminder type.'
        });
      }
      updateFields.push('reminder_type = ?');
      updateValues.push(type);
    }
    if (time !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Use HH:MM format.'
        });
      }
      updateFields.push('time = ?');
      updateValues.push(time);
    }
    if (days !== undefined) {
      if (days.monday !== undefined) {
        updateFields.push('monday = ?');
        updateValues.push(days.monday ? 1 : 0);
      }
      if (days.tuesday !== undefined) {
        updateFields.push('tuesday = ?');
        updateValues.push(days.tuesday ? 1 : 0);
      }
      if (days.wednesday !== undefined) {
        updateFields.push('wednesday = ?');
        updateValues.push(days.wednesday ? 1 : 0);
      }
      if (days.thursday !== undefined) {
        updateFields.push('thursday = ?');
        updateValues.push(days.thursday ? 1 : 0);
      }
      if (days.friday !== undefined) {
        updateFields.push('friday = ?');
        updateValues.push(days.friday ? 1 : 0);
      }
      if (days.saturday !== undefined) {
        updateFields.push('saturday = ?');
        updateValues.push(days.saturday ? 1 : 0);
      }
      if (days.sunday !== undefined) {
        updateFields.push('sunday = ?');
        updateValues.push(days.sunday ? 1 : 0);
      }
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive ? 1 : 0);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await db.query(
        `UPDATE reminders SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    const [updatedReminder] = await db.query(
      `SELECT 
        id, title, reminder_type as type, time, 
        monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        notes, is_active as isActive, created_at as createdAt
      FROM reminders 
      WHERE id = ?`,
      [id]
    );

    const formattedReminder = {
      ...updatedReminder[0],
      days: {
        monday: updatedReminder[0].monday === 1,
        tuesday: updatedReminder[0].tuesday === 1,
        wednesday: updatedReminder[0].wednesday === 1,
        thursday: updatedReminder[0].thursday === 1,
        friday: updatedReminder[0].friday === 1,
        saturday: updatedReminder[0].saturday === 1,
        sunday: updatedReminder[0].sunday === 1
      },
      isActive: updatedReminder[0].isActive === 1,
      monday: undefined,
      tuesday: undefined,
      wednesday: undefined,
      thursday: undefined,
      friday: undefined,
      saturday: undefined,
      sunday: undefined
    };

    res.status(200).json({
      success: true,
      message: 'Reminder updated successfully.',
      reminder: formattedReminder
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating reminder.'
    });
  }
};

// Toggle Reminder Active Status
exports.toggleReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if reminder exists and belongs to user
    const [reminders] = await db.query(
      'SELECT is_active FROM reminders WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (reminders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found.'
      });
    }

    const newStatus = reminders[0].is_active === 1 ? 0 : 1;
    await db.query('UPDATE reminders SET is_active = ? WHERE id = ?', [newStatus, id]);

    res.status(200).json({
      success: true,
      message: `Reminder ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
      isActive: newStatus === 1
    });
  } catch (error) {
    console.error('Toggle reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling reminder.'
    });
  }
};

// Delete Reminder
exports.deleteReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if reminder exists and belongs to user
    const [reminders] = await db.query(
      'SELECT id FROM reminders WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (reminders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found.'
      });
    }

    await db.query('DELETE FROM reminders WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully.'
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting reminder.'
    });
  }
};