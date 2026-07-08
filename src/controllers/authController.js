/**
 * Legacy alias file.
 *
 * Some older routes and setup guides still point to authController.js.
 * This file now re-exports the stable auth.controller.js implementation.
 */
module.exports = require('./auth.controller');
