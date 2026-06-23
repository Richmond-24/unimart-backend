const router = require('express').Router();
const User = require('../models/User.model');
const { protect } = require('../middleware/auth.middleware');

// Update profile
router.put('/me', protect, async (req, res, next) => {
  try {
    const allowed = ['name','phone','avatar','university','hall','pushToken'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// Get saved items
router.get('/saved', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('savedItems','title price images rating');
    res.json({ success: true, data: user.savedItems });
  } catch (err) { next(err); }
});
module.exports = router;
