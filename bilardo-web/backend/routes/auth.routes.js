// routes/auth.routes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, updateProfile } = require('../controllers/auth.controller');
const { authRequired } = require('../middleware/auth.middleware');

// M2: throttle authentication endpoints to slow down credential brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', authLimiter, register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authLimiter, login);

// @route   PUT api/auth/profile
// @desc    Update the authenticated user's profile
// @access  Private (JWT required)
router.put('/profile', authRequired, updateProfile);

module.exports = router;
