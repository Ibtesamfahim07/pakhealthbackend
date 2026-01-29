const db = require('../../config/database');

// Get User Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const [users] = await db.query(
      'SELECT id, email, name, profile_image, age, gender, diabetes_type, diagnosis_year, is_developer, fcm_token, created_at, last_active FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Get medications
    const [medications] = await db.query(
      'SELECT medication_name FROM medications WHERE user_id = ?',
      [userId]
    );

    const userData = {
      ...users[0],
      medications: medications.map(m => m.medication_name),
      isDeveloper: users[0].is_developer === 1
    };

    res.status(200).json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile.'
    });
  }
};

// Update User Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Log incoming request body for debugging
    console.log('Update profile request body:', req.body);
    
    const {
      name,
      profileImage,
      profile_image,
      age,
      gender,
      // Accept both camelCase and snake_case
      diabetesType,
      diabetes_type,
      diagnosisYear,
      diagnosis_year,
      medications
    } = req.body;

    // Use whichever format was sent (camelCase or snake_case)
    const finalDiabetesType = diabetesType || diabetes_type;
    const finalDiagnosisYear = diagnosisYear || diagnosis_year;
    const finalProfileImage = profileImage || profile_image;

    // Validation
    if (age && (age < 0 || age > 150)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid age.'
      });
    }

    if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender value.'
      });
    }

    if (finalDiabetesType && !['Type 1', 'Type 2', 'Gestational'].includes(finalDiabetesType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid diabetes type. Must be "Type 1", "Type 2", or "Gestational".'
      });
    }

    // Validate diagnosis year
    const currentYear = new Date().getFullYear();
    if (finalDiagnosisYear && (finalDiagnosisYear < 1900 || finalDiagnosisYear > currentYear)) {
      return res.status(400).json({
        success: false,
        message: `Please provide a valid diagnosis year between 1900 and ${currentYear}.`
      });
    }

    // Update user data
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (finalProfileImage !== undefined) {
      updateFields.push('profile_image = ?');
      updateValues.push(finalProfileImage);
    }
    if (age !== undefined) {
      updateFields.push('age = ?');
      updateValues.push(age);
    }
    if (gender !== undefined) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (finalDiabetesType !== undefined) {
      updateFields.push('diabetes_type = ?');
      updateValues.push(finalDiabetesType);
    }
    if (finalDiagnosisYear !== undefined) {
      updateFields.push('diagnosis_year = ?');
      updateValues.push(parseInt(finalDiagnosisYear, 10));
    }

    console.log('Update fields:', updateFields);
    console.log('Update values:', updateValues);

    if (updateFields.length > 0) {
      updateValues.push(userId);
      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      console.log('Executing query:', query);
      await db.query(query, updateValues);
    }

    // Update medications
    if (medications !== undefined && Array.isArray(medications)) {
      // Delete existing medications
      await db.query('DELETE FROM medications WHERE user_id = ?', [userId]);

      // Insert new medications
      if (medications.length > 0) {
        const medicationValues = medications.map(med => [userId, med]);
        await db.query(
          'INSERT INTO medications (user_id, medication_name) VALUES ?',
          [medicationValues]
        );
      }
    }

    // Get updated user data
    const [users] = await db.query(
      'SELECT id, email, name, profile_image, age, gender, diabetes_type, diagnosis_year, is_developer, fcm_token FROM users WHERE id = ?',
      [userId]
    );

    const [updatedMedications] = await db.query(
      'SELECT medication_name FROM medications WHERE user_id = ?',
      [userId]
    );

    const userData = {
      ...users[0],
      // Return both formats for frontend compatibility
      diabetesType: users[0].diabetes_type,
      diagnosisYear: users[0].diagnosis_year,
      profileImage: users[0].profile_image,
      medications: updatedMedications.map(m => m.medication_name),
      isDeveloper: users[0].is_developer === 1
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: userData
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile.'
    });
  }
};

// Get All Users (for developer dashboard)
exports.getAllUsers = async (req, res) => {
  try {
    // Check if user is developer
    if (!req.user.is_developer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Developer privileges required.'
      });
    }

    // Get all users
    const [users] = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.age, u.gender, 
        u.diabetes_type, u.diagnosis_year, u.created_at, u.last_active,
        COUNT(DISTINCT sr.id) as sugar_readings_count,
        COUNT(DISTINCT r.id) as reminders_count,
        COUNT(DISTINCT fh.id) as foot_health_count
      FROM users u
      LEFT JOIN sugar_readings sr ON u.id = sr.user_id
      LEFT JOIN reminders r ON u.id = r.user_id AND r.is_active = 1
      LEFT JOIN foot_health_records fh ON u.id = fh.user_id
      WHERE u.is_developer = 0
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    // Get medications for each user
    for (let user of users) {
      const [medications] = await db.query(
        'SELECT medication_name FROM medications WHERE user_id = ?',
        [user.id]
      );
      user.medications = medications.map(m => m.medication_name);

      // Get recent sugar readings
      const [recentReadings] = await db.query(
        'SELECT id, value, reading_type, timestamp, notes FROM sugar_readings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5',
        [user.id]
      );
      user.sugarReadings = recentReadings;

      // Get active reminders
      const [activeReminders] = await db.query(
        'SELECT id, title, reminder_type, time, is_active FROM reminders WHERE user_id = ? AND is_active = 1 LIMIT 5',
        [user.id]
      );
      user.reminders = activeReminders;

      // Get recent foot health data
      const [footHealthData] = await db.query(
        'SELECT id, date, steps, rollers, resisted_exercise FROM foot_health_records WHERE user_id = ? ORDER BY date DESC LIMIT 3',
        [user.id]
      );
      user.footHealthData = footHealthData;
    }

    res.status(200).json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users.'
    });
  }
};