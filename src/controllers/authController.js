const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../config/database');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register User
exports.register = async (req, res) => {
  try {
    const { email, password, name, fcm_token } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if user already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userId = uuidv4();
    await db.query(
      'INSERT INTO users (id, email, password, name, fcm_token) VALUES (?, ?, ?, ?, ?)',
      [userId, email.toLowerCase(), hashedPassword, name, fcm_token || null]
    );

    // Generate token
    const token = generateToken(userId);

    // Get user data (without password)
    const [users] = await db.query(
      'SELECT id, email, name, profile_image, age, gender, diabetes_type, diagnosis_year, is_developer FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: users[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration.'
    });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password, fcm_token } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // Check if user exists
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Update last active and FCM token if provided
    if (fcm_token) {
      await db.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP, fcm_token = ? WHERE id = ?',
        [fcm_token, user.id]
      );
    } else {
      await db.query(
        'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
    }

    // Get medications
    const [medications] = await db.query(
      'SELECT medication_name FROM medications WHERE user_id = ?',
      [user.id]
    );

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImage: user.profile_image,
      age: user.age,
      gender: user.gender,
      diabetesType: user.diabetes_type,
      diagnosisYear: user.diagnosis_year,
      isDeveloper: user.is_developer === 1,
      medications: medications.map(m => m.medication_name)
    };

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
};

// Logout (client-side token removal, but we can track it)
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout.'
    });
  }
};