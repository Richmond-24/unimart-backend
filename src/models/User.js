const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    // Personal Info
    firstName: {
      type: String,
      required: [true, 'Please provide a first name'],
      trim: true,
      maxlength: [50, 'First name cannot be longer than 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Please provide a last name'],
      trim: true,
      maxlength: [50, 'Last name cannot be longer than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      match: [/^[\d\s\-\+\(\)]{10,}$/, 'Please provide a valid phone number'],
    },

    // Authentication
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Campus Information
    university: {
      type: String,
      enum: [
        'University of Ghana',
        'KNUST',
        'University of Cape Coast',
        'Central University',
        'Accra Institute of Technology',
        'Other',
      ],
    },
    yearOfStudy: {
      type: String,
      enum: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Fifth Year', 'Graduate'],
    },
    major: String,
    studentID: String,

    // Profile
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150?text=User+Avatar',
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be longer than 500 characters'],
    },
    location: String,

    // Verification & Status
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: String,

    // Role & Permissions
    role: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      default: 'buyer',
    },
    isSellerApproved: {
      type: Boolean,
      default: false,
    },
    sellerApprovedAt: Date,
    sellerRejectionReason: String,

    // Seller Information (if applicable)
    sellerProfile: {
      shopName: String,
      shopDescription: String,
      shopBanner: String,
      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      totalReviews: {
        type: Number,
        default: 0,
      },
      totalSales: {
        type: Number,
        default: 0,
      },
      responseTime: {
        type: Number, // in hours
        default: 24,
      },
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      documents: {
        businessLicense: String,
        idProof: String,
        proofOfAddress: String,
      },
    },

    // Preferences
    preferences: {
      newsletter: {
        type: Boolean,
        default: true,
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      privateProfile: {
        type: Boolean,
        default: false,
      },
    },

    // Account Activity
    lastLogin: Date,
    lastActivity: Date,
    loginCount: {
      type: Number,
      default: 0,
    },

    // Relationships
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user info (without sensitive data)
UserSchema.methods.getPublicProfile = function () {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  return user;
};

// Index for faster queries
UserSchema.index({ email: 1 });
UserSchema.index({ studentID: 1 });
UserSchema.index({ 'sellerProfile.shopName': 1 });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
