// models/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the schema for the User model
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: 3
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  score: {
    type: Number,
    default: 0
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  equippedCue: {
    type: String,
    default: 'standard'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Middleware to hash password before saving a new user
UserSchema.pre('save', async function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }

  // Generate a salt
  const salt = await bcrypt.genSalt(10);
  // Hash the password with the salt
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare candidate password with the hashed password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create the User model from the schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
