# Authentication System Setup Guide

## Overview
Complete authentication system with email verification, password reset, and JWT tokens has been created in the backend.

## Files Created

### 1. **models/User.js** - Enhanced User Schema
- Comprehensive user model with extended fields
- Supports buyers, sellers, and admins
- Email verification workflow
- Password reset functionality
- Seller profile information
- Account activity tracking

**Key Fields:**
- Personal: firstName, lastName, email, phone
- Authentication: password, passwordChangedAt, passwordResetToken
- Campus: university, yearOfStudy, major, studentID
- Profile: avatar, bio, location
- Verification: emailVerified, emailVerificationToken
- Role & Status: role, isSellerApproved, isSuspended
- Seller Profile: shopName, shopDescription, rating, etc.
- Relationships: followers, following, favorites
- Activity: lastLogin, loginCount, lastActivity

### 2. **utils/generateToken.js** - JWT Token Generation
Functions:
- `generateToken(userId, role)` - Create access token (30 days)
- `generateRefreshToken(userId)` - Create refresh token (90 days)
- `verifyToken(token)` - Verify and decode token
- `decodeToken(token)` - Decode without verification

### 3. **utils/emailService.js** - Email Service
Functions:
- `sendVerificationEmail()` - Send email verification link
- `sendPasswordResetEmail()` - Send password reset link
- `sendWelcomeEmail()` - Welcome new users
- `sendSellerApprovalEmail()` - Notify seller approval
- `testEmailConfiguration()` - Test email setup

Supports multiple email services:
- Gmail
- SendGrid
- Mailtrap (default)

### 4. **middleware/auth.js** - Authentication Middleware
Exports:
- `authMiddleware` - Verify JWT and attach user to request
- `roleMiddleware(allowedRoles)` - Check user roles
- `sellerMiddleware` - Seller-only endpoints
- `adminMiddleware` - Admin-only endpoints
- `optionalAuthMiddleware` - Optional authentication
- `authRateLimitMiddleware` - Rate limiting for auth endpoints

### 5. **controllers/authController.js** - Business Logic
Functions:
- `register()` - User registration with email verification
- `login()` - User login with refresh token
- `logout()` - User logout
- `getCurrentUser()` - Get authenticated user profile
- `updateProfile()` - Update user profile
- `changePassword()` - Change user password
- `forgotPassword()` - Send password reset email
- `resetPassword()` - Reset password with token
- `verifyEmail()` - Verify email with token

### 6. **routes/auth.js** - Authentication Routes
Endpoints:

**Public Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-email` - Verify email with token

**Protected Endpoints:**
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

---

## Configuration

### Environment Variables
Required in `.env`:
```
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=30d
MONGO_URI=your_mongodb_connection_string

# Email Configuration (choose one)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# OR for SendGrid
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Optional
APP_URL=http://localhost:3000
EMAIL_FROM=noreply@unimart.com
```

### Dependencies Installed
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT tokens
- `mongoose` - Database
- `dotenv` - Environment variables
- `nodemailer` - Email service (just installed)

---

## Integration Steps

### Option 1: Replace Existing Auth System
If you want to use the new comprehensive system:

1. **Replace the User model:**
   ```bash
   mv src/models/User.js src/models/User.model.js (backup old)
   # Use new User.js
   ```

2. **Replace auth routes:**
   ```bash
   mv src/routes/auth.js src/routes/auth.routes.js
   ```

3. **Replace auth controller:**
   ```bash
   mv src/controllers/authController.js src/controllers/auth.controller.js
   ```

4. **Replace auth middleware:**
   ```bash
   mv src/middleware/auth.js src/middleware/auth.middleware.js
   ```

5. **Update server.js imports** if needed

### Option 2: Coexist with Existing System
The new files are named differently and can coexist:
- Keep existing `User.model.js`
- Add new `User.js` for extended features
- Use both in different contexts

---

## Usage Examples

### 1. User Registration
```javascript
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePassword123",
  "passwordConfirm": "SecurePassword123",
  "university": "University of Ghana",
  "yearOfStudy": "Second Year"
}

Response:
{
  "success": true,
  "message": "Registration successful! Check your email to verify your account.",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

### 2. User Login
```javascript
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}

Response:
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "refresh_token",
      "expiresIn": "30d"
    }
  }
}
```

### 3. Get Current User Profile
```javascript
GET /api/auth/me
Headers: Authorization: Bearer jwt_token_here

Response:
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

### 4. Update Profile
```javascript
PUT /api/auth/profile
Headers: Authorization: Bearer jwt_token_here
{
  "firstName": "John",
  "bio": "Student and seller",
  "location": "Legon"
}
```

### 5. Change Password
```javascript
POST /api/auth/change-password
Headers: Authorization: Bearer jwt_token_here
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456",
  "passwordConfirm": "NewPassword456"
}
```

### 6. Forgot Password
```javascript
POST /api/auth/forgot-password
{
  "email": "john@example.com"
}
```

---

## Middleware Usage

### Protect Routes with Authentication
```javascript
const { authMiddleware } = require('./middleware/auth');

router.get('/protected-route', authMiddleware, (req, res) => {
  // req.user contains user info
  console.log(req.user.id); // User ID
  console.log(req.user.role); // User role
});
```

### Seller-only Routes
```javascript
const { sellerMiddleware } = require('./middleware/auth');

router.post('/seller/product', sellerMiddleware, (req, res) => {
  // Only sellers can access
});
```

### Admin-only Routes
```javascript
const { adminMiddleware } = require('./middleware/auth');

router.delete('/admin/users/:id', adminMiddleware, (req, res) => {
  // Only admins can access
});
```

---

## Email Service Setup

### Using Gmail (Recommended for Development)
1. Enable "Less secure apps" or use App Password
2. Set in `.env`:
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_specific_password
   ```

### Using SendGrid (Recommended for Production)
1. Create SendGrid account and get API key
2. Set in `.env`:
   ```
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   ```

### Using Mailtrap (Default - for Testing)
1. Create Mailtrap account
2. Set in `.env`:
   ```
   MAILTRAP_USER=your_mailtrap_user
   MAILTRAP_PASSWORD=your_mailtrap_password
   ```

---

## Security Features

✅ Password hashing with bcrypt
✅ JWT token-based authentication
✅ Email verification workflow
✅ Password reset with token expiry
✅ Rate limiting on auth endpoints
✅ Account suspension support
✅ Last login tracking
✅ Password change tracking
✅ Secure token storage (not in cookies by default)

---

## Key Differences from Existing System

| Feature | Old System | New System |
|---------|-----------|-----------|
| Password Reset | Not implemented | Full workflow with email |
| Email Verification | Not implemented | Built-in verification |
| Seller Details | In User model | Separate sellerProfile object |
| Account Status | Simple banned flag | Suspended with reason |
| Activity Tracking | None | Detailed login/activity history |
| User Relationships | None | Followers, following, favorites |
| Password Hashing | bcryptjs | bcrypt (more modern)|

---

## Testing the APIs

Using cURL or Postman:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"Test123456","passwordConfirm":"Test123456"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'

# Get Profile
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Next Steps

1. ✅ Review the created files
2. ⚠️ Choose integration strategy (Option 1 or 2)
3. ⚠️ Configure environment variables for emails
4. ⚠️ Test endpoints with Postman
5. ⚠️ Integrate with frontend authentication
6. ⚠️ Set up error handling for production
7. ⚠️ Consider adding two-factor authentication
8. ⚠️ Implement refresh token rotation

---

**Created:** April 3, 2026
**Status:** Ready for integration
**Files Count:** 6 new files
**Lines of Code:** 1000+
