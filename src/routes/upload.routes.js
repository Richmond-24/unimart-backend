
const express = require('express');
const router = express.Router();
const { uploadProductImages, uploadProfileImage } = require('../services/cloudinaryService');

// Upload multiple product images (up to 5)
router.post('/products', uploadProductImages.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files uploaded' 
      });
    }

    // Get the Cloudinary URLs from uploaded files
    const imageUrls = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      format: file.format,
      width: file.width,
      height: file.height
    }));

    console.log('✅ Images uploaded to Cloudinary:');
    imageUrls.forEach(img => console.log('   📸', img.url));

    res.json({
      success: true,
      urls: imageUrls.map(img => img.url), // Simple URLs array for easy use
      images: imageUrls, // Full metadata if needed
      count: imageUrls.length
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload single product image
router.post('/product', uploadProductImages.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const imageData = {
      url: req.file.path,
      publicId: req.file.filename,
      format: req.file.format,
      width: req.file.width,
      height: req.file.height
    };

    console.log('✅ Image uploaded to Cloudinary:', imageData.url);

    res.json({
      success: true,
      url: imageData.url,
      image: imageData
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload profile image
router.post('/profile', uploadProfileImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const imageData = {
      url: req.file.path,
      publicId: req.file.filename,
      format: req.file.format,
      width: req.file.width,
      height: req.file.height
    };

    console.log('✅ Profile image uploaded to Cloudinary:', imageData.url);

    res.json({
      success: true,
      url: imageData.url,
      image: imageData
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete image from Cloudinary
router.delete('/image', async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'publicId is required' 
      });
    }

    const { deleteImage } = require('../services/cloudinaryService');
    const result = await deleteImage(publicId);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test endpoint to verify upload route is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Upload routes are working',
    cloudinaryConfigured: !!process.env.CLOUDINARY_CLOUD_NAME
  });
});

module.exports = router;