// controllers/auth.controller.js
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const { username, password } = req.body;

  // M1: reject non-string inputs so MongoDB operators (e.g. {"$ne": null})
  // can't be smuggled into the query via a JSON object value.
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create a new user
    const user = new User({
      username,
      password,
    });

    // Save the user to the database (password will be hashed by the pre-save middleware)
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      userId: user._id,
    });
  } catch (error) {
    // L1: log details server-side, return a generic message to the client.
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const { username, password } = req.body;

  // M1: reject non-string inputs (NoSQL operator injection guard).
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // User matched, create JWT payload. The username is embedded so that both
    // the Express and Socket.IO auth guards can derive identity from the token.
    const payload = {
      user: {
        id: user.id,
        username: user.username,
      },
    };

    // Sign the token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }, // Token expires in 1 hour
      (err, token) => {
        if (err) throw err;
        res.json({
          message: 'Login successful',
          token,
          avatarUrl: user.avatarUrl,
          equippedCue: user.equippedCue
        });
      }
    );
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update the authenticated user's profile
// @route   PUT /api/auth/profile
// @access  Private (requires a valid JWT)
exports.updateProfile = async (req, res) => {
  // H3: identity comes from the verified token (authRequired middleware),
  // never from the request body — a user can only update their own profile.
  const username = req.user.username;
  const { avatarUrl, equippedCue } = req.body;

  // M1: only accept string values for the updatable fields.
  const updates = {};
  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== 'string') return res.status(400).json({ message: 'Invalid input' });
    updates.avatarUrl = avatarUrl;
  }
  if (equippedCue !== undefined) {
    if (typeof equippedCue !== 'string') return res.status(400).json({ message: 'Invalid input' });
    updates.equippedCue = equippedCue;
  }

  try {
    const user = await User.findOneAndUpdate(
      { username },
      updates,
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
