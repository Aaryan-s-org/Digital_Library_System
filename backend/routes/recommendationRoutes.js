const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { optionalAuthToken, authenticateToken, authorize } = require('../middleware/authMiddleware');

// Get personalized recommendations (works for authenticated members and guests)
router.get('/', optionalAuthToken, recommendationController.getRecommendations);

// Track search query to update user preference profile
router.post('/track-search', optionalAuthToken, recommendationController.trackSearch);

// Get ML model metadata and training status
router.get('/model-info', recommendationController.getModelInfo);

// Retrain ML model (Admin or Librarian)
router.post('/retrain', authenticateToken, authorize(['Admin', 'Librarian']), recommendationController.retrainModel);

module.exports = router;
