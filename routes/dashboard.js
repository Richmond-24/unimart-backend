const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Dashboard routes - all return REAL data from database
router.get('/kpi', dashboardController.getKPI);
router.get('/sales-trend', dashboardController.getSalesTrend);
router.get('/categories', dashboardController.getCategoryPerformance);
router.get('/top-products', dashboardController.getTopProducts);
router.get('/geo', dashboardController.getGeoDistribution);
router.get('/activity', dashboardController.getActivityFeed);
router.get('/users', dashboardController.getUserStats);

module.exports = router;