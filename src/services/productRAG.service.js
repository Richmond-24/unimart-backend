/**
 * Product RAG Service (CommonJS)
 * Retrieves product knowledge for AI agent context
 * Uses Supabase pgvector for semantic search
 * Falls back to MongoDB text search if vector DB not available
 */

const mongoose = require('mongoose');
let OpenAI = null;
try {
  OpenAI = require('openai/index.mjs').OpenAI;
} catch (err) {
  console.warn('⚠️  OpenAI package not available');
}
require('dotenv').config();

const Listing = require('../models/Listing');
const Product = require('../models/Product.model');

class ProductRAGService {
  constructor() {
    this.openaiClient = null;
    this.openaiAvailable = false;

    // Only initialize OpenAI if API key is provided and library is available
    if (OpenAI && process.env.OPENAI_API_KEY) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.openaiAvailable = true;
        console.log('✅ OpenAI client initialized');
      } catch (err) {
        console.warn('⚠️  Failed to initialize OpenAI:', err.message);
      }
    } else {
      console.log('⚠️  OpenAI not configured - using MongoDB text search only');
    }

    this.supabaseUrl = process.env.SUPABASE_URL || null;
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  }

  /**
   * Generate embeddings for a query using OpenAI
   */
  async generateEmbedding(text) {
    if (!this.openaiAvailable) {
      // Return a dummy embedding array if OpenAI is not available
      return new Array(1536).fill(0.1);
    }
    try {
      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Search products using vector similarity (Supabase pgvector)
   * This is the primary method for semantic search
   */
  async searchProductsVector(query, limit = 5) {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Supabase not configured, falling back to text search');
      return this.searchProductsText(query, limit);
    }

    try {
      // Generate embedding for the query
      const embedding = await this.generateEmbedding(query);

      // Call Supabase pgvector endpoint
      const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/search_products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_embedding: embedding,
          similarity_threshold: 0.5,
          match_count: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`Supabase search failed: ${response.statusText}`);
      }

      const results = await response.json();
      return results.map((r) => this.formatProductData(r.product));
    } catch (error) {
      console.error('Vector search error:', error);
      return this.searchProductsText(query, limit);
    }
  }

  /**
   * Fallback: Search products using MongoDB text search
   */
  async searchProductsText(query, limit = 5) {
    try {
      // Use MongoDB text search on Listing collection
      const listings = await Listing.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();

      return listings.map((listing) => this.formatListingData(listing));
    } catch (error) {
      console.error('Text search error:', error);
      // Fallback to basic regex search
      return this.searchProductsRegex(query, limit);
    }
  }

  /**
   * Fallback: Basic regex search
   */
  async searchProductsRegex(query, limit = 5) {
    try {
      const regex = new RegExp(query, 'i');
      const listings = await Listing.find({
        $or: [
          { title: regex },
          { description: regex },
          { category: regex },
          { tags: regex },
        ],
      })
        .limit(limit)
        .lean();

      return listings.map((listing) => this.formatListingData(listing));
    } catch (error) {
      console.error('Regex search error:', error);
      return [];
    }
  }

  /**
   * Search products by category - for category-specific questions
   */
  async searchByCategory(category, productName, limit = 5) {
    try {
      const query = { category: { $regex: category, $options: 'i' } };

      if (productName) {
        query.title = { $regex: productName, $options: 'i' };
      }

      const listings = await Listing.find(query)
        .limit(limit)
        .lean();

      return listings.map((listing) => this.formatListingData(listing));
    } catch (error) {
      console.error('Category search error:', error);
      return [];
    }
  }

  /**
   * Get detailed product info for a specific product ID
   */
  async getProductById(productId) {
    try {
      const listing = await Listing.findById(productId).lean();
      if (!listing) return null;

      return this.formatListingData(listing);
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  /**
   * Get seller information for reliable answers about seller policies
   */
  async getSellerInfo(sellerEmail) {
    try {
      const listings = await Listing.find({ sellerEmail })
        .limit(10)
        .lean();

      if (!listings.length) return null;

      // Aggregate seller info from their listings
      const seller = {
        name: listings[0].sellerName,
        email: sellerEmail,
        phone: listings[0].sellerPhone,
        location: listings[0].location,
        businessName: listings[0].businessName,
        totalListings: listings.length,
        categories: [...new Set(listings.map((l) => l.category))],
        avgPrice: Math.round(
          listings.reduce((sum, l) => sum + l.price, 0) / listings.length
        ),
      };

      return seller;
    } catch (error) {
      console.error('Error fetching seller info:', error);
      return null;
    }
  }

  /**
   * Format listing document to ProductData
   */
  formatListingData(listing) {
    return {
      id: listing._id?.toString() || '',
      title: listing.title,
      description: listing.description,
      price: listing.price,
      discount: listing.discount || 0,
      category: listing.category,
      condition: listing.condition,
      sellerName: listing.sellerName,
      sellerEmail: listing.sellerEmail,
      sellerPhone: listing.sellerPhone,
      rating: listing.rating || 0,
      reviews: listing.reviews || 0,
      location: listing.location,
      images: listing.images,
      brand: listing.brand,
      stock: listing.stock || 0,
      tags: listing.tags || [],
    };
  }

  /**
   * Format product document to ProductData
   */
  formatProductData(product) {
    return {
      id: product.id?.toString() || '',
      title: product.name || product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      condition: 'New',
      sellerName: product.seller?.name || 'Unknown',
      sellerEmail: product.seller?.email || '',
      rating: product.rating || 0,
      reviews: product.reviewCount || 0,
      stock: product.stock || 0,
      images: product.images || [],
    };
  }

  /**
   * Build RAG context string for the AI agent
   */
  formatContextForAgent(products) {
    if (!products.length) {
      return 'No relevant products found in the database.';
    }

    const formattedProducts = products
      .map(
        (p, i) =>
          `[Product ${i + 1}]
      Title: ${p.title}
      Price: GHS ${p.price}${p.discount ? ` (${p.discount}% off, was GHS ${Math.round(p.price / (1 - p.discount / 100))}` : ''}
      Category: ${p.category}
      Condition: ${p.condition}
      Description: ${p.description}
      Seller: ${p.sellerName} (${p.sellerEmail})
      Stock: ${p.stock} available
      Rating: ${p.rating}/5 (${p.reviews} reviews)`
      )
      .join('\n\n');

    return `Here are relevant products from our database:\n\n${formattedProducts}`;
  }
}

module.exports = new ProductRAGService();
