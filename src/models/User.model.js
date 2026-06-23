const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, sparse: true,
                 match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
  password:    { type: String, required: true, minlength: 6, select: false },
  phone:       { type: String, default: '' },
  avatar:      { type: String, default: '' },
  university:  { type: String, default: '' },
  // Human-readable location (city, region)
  location:     { type: String, default: '' },
  // Optional coordinates for more accurate handling
  locationCoords: {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
  },
  studentId:   { type: String, default: '' },
  department:  { type: String, default: '' },
  role:        { type: String, enum: ['buyer', 'seller', 'admin', 'guest'], default: 'buyer' },
  isVerified:  { type: Boolean, default: false },
  isBanned:    { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
  isGuest:     { type: Boolean, default: false }, // For guest users
  guestId:     { type: String, unique: true, sparse: true }, // Unique ID for guests
  savedItems:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  pushToken:   { type: String, default: '' },
  lastLogin:   { type: Date },
  createdAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Sign JWT
UserSchema.methods.getSignedJwt = function () {
  return jwt.sign({ id: this._id, role: this.role },
    process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
};

// Compare password
UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);
