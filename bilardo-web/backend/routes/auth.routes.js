// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { register, login, updateProfile } = require('../controllers/auth.controller');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', login);

// @route   PUT api/auth/profile
// @desc    Update user profile data
// @access  Public
router.put('/profile', updateProfile);

module.exports = router;
