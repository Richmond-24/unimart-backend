const router = require('express').Router();
const ctrl = require('../controllers/listing.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/',              ctrl.getEvents);
router.get('/:id',           ctrl.getEvent);
router.post('/',             protect, ctrl.createEvent);
router.post('/:id/rsvp',     protect, ctrl.rsvpEvent);
module.exports = router;
