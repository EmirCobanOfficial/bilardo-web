// controllers/leaderboard.controller.js
const User = require('../models/user.model');

exports.getLeaderboard = async (req, res) => {
  try {
    // Get top 10 users sorted by score in descending order
    const topUsers = await User.find().sort({ score: -1 }).limit(10).select('username score -_id');
    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};