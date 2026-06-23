/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles product/service search with semantic similarity using embeddings
 * Supports OpenAI embeddings or local alternatives
 */

const axios = require('axios');
const mongoose = require('mongoose');

class RAGService {
  constructor() {
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'; // OpenAI
    this.embeddingApiUrl = process.env.EMBEDDING_API_URL || 'https://api.openai.com/v1/embeddings';
    this.useLocalEmbeddings = process.env.USE_LOCAL_EMBEDDINGS === 'true'; // For Ollama
    this.localEmbeddingUrl = process.env.LOCAL_EMBEDDING_URL || 'http://localhost:11434/api/embeddings';
    this.localEmbeddingModel = process.env.LOCAL_EMBEDDING_MODEL || 'nomic-embed-text';
    this.similarityThreshold = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.6');
  }

  /**
   * Generate embedding for a query string
   * Uses OpenAI API or local Ollama service
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input for embedding');
    }

    try {
      if (this.useLocalEmbeddings) {
        return await this._generateLocalEmbedding(text);
      } else {
        return await this._generateOpenAIEmbedding(text);
      }
    } catch (error) {
      console.error('❌ Embedding generation failed:', error.message);
      throw error;
    }
  }

  /**
   * OpenAI embedding generation
   */
  async _generateOpenAIEmbedding(text) {
    const response = await axios.post(
      this.embeddingApiUrl,
      {
        input: text.substring(0, 8191), // OpenAI limit
        model: this.embeddingModel,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (!response.data?.data?.[0]?.embedding) {
      throw new Error('No embedding received from OpenAI');
    }

    return response.data.data[0].embedding;
  }

  /**
   * Local Ollama embedding generation
   */
  async _generateLocalEmbedding(text) {
    const response = await axios.post(
      this.localEmbeddingUrl,
      {
        model: this.localEmbeddingModel,
        prompt: text.substring(0, 8191),
      },
      { timeout: 10000 }
    );

    if (!response.data?.embedding) {
      throw new Error('No embedding received from local service');
    }

    return response.data.embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions do not match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Search products by semantic similarity
   * In production, use vector database (Qdrant, Pinecone, etc.)
   * For MVP: does keyword + category match, falls back to semantic similarity
   */
  async searchProducts(query, limit = 5) {
    try {
      const Product = mongoose.model('Product');

      // First pass: Fast keyword and category matching
      const keywordMatches = await Product.find({
        isActive: true,
        status: 'approved',
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
        .select('_id name description price category images stock')
        .limit(limit)
        .exec();

      if (keywordMatches.length >= limit) {
        return keywordMatches.map((p) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          images: p.images,
          stock: p.stock,
          relevanceScore: 1.0, // Exact match
        }));
      }

      // Second pass: If fewer results, try semantic search on all active products
      if (process.env.ENABLE_SEMANTIC_SEARCH === 'true') {
        const queryEmbedding = await this.generateEmbedding(query);
        const allProducts = await Product.find({
          isActive: true,
          status: 'approved',
        })
          .select('_id name description price category images stock')
          .limit(100)
          .exec();

        const scoredProducts = [];
        for (const product of allProducts) {
          const productText = `${product.name} ${product.description}`;
          const productEmbedding = await this.generateEmbedding(productText);
          const score = this.cosineSimilarity(queryEmbedding, productEmbedding);

          if (score >= this.similarityThreshold) {
            scoredProducts.push({
              id: product._id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              images: product.images,
              stock: product.stock,
              relevanceScore: score,
            });
          }
        }

        // Sort by relevance and return top N
        return scoredProducts
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, limit);
      }

      return keywordMatches;
    } catch (error) {
      console.error('❌ Product search error:', error.message);
      return []; // Return empty array instead of failing
    }
  }

  /**
   * Search services by semantic similarity
   */
  async searchServices(query, limit = 3) {
    try {
      const Service = mongoose.model('Service');

      // Fast keyword matching
      const matches = await Service.find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
        .select('_id name description provider price category')
        .limit(limit)
        .exec();

      return matches.map((s) => ({
        id: s._id,
        name: s.name,
        description: s.description,
        provider: s.provider,
        price: s.price,
        category: s.category,
        relevanceScore: 1.0,
      }));
    } catch (error) {
      console.error('❌ Service search error:', error.message);
      return [];
    }
  }

  /**
   * Search food listings
   */
  async searchFood(query, limit = 3) {
    try {
      const Food = mongoose.model('Food');

      const matches = await Food.find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
        .select('_id name description price vendor deliveryTime')
        .limit(limit)
        .exec();

      return matches.map((f) => ({
        id: f._id,
        name: f.name,
        description: f.description,
        price: f.price,
        vendor: f.vendor,
        deliveryTime: f.deliveryTime,
        relevanceScore: 1.0,
      }));
    } catch (error) {
      console.error('❌ Food search error:', error.message);
      return [];
    }
  }

  /**
   * Get user context for personalized responses
   */
  async getUserContext(userId) {
    try {
      const User = mongoose.model('User');
      const Cart = mongoose.model('Cart');

      const user = await User.findById(userId).select('savedItems campus location');
      const cart = await Cart.findOne({ user: userId }).select('items');

      return {
        cartItems: cart?.items || [],
        savedItems: user?.savedItems || [],
        campus: user?.campus || 'Unknown',
        preferences: {
          categories: [],
          priceRange: { min: 0, max: 1000 },
        },
      };
    } catch (error) {
      console.error('❌ User context error:', error.message);
      return {
        cartItems: [],
        savedItems: [],
        campus: 'Unknown',
        preferences: { categories: [], priceRange: { min: 0, max: 1000 } },
      };
    }
  }
}

module.exports = new RAGService();
