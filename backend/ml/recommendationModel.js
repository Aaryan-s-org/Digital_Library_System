/**
 * recommendationModel.js — Machine Learning Recommendation Model
 *
 * Implements a Content-Based Vector Space Model (TF-IDF + Cosine Similarity)
 * blended with User Behavioral Signals (Exponential Recency Decay of Searches
 * and Reading Progress) plus Collaborative Popularity Priors and Explainable AI.
 */

class RecommendationModel {
  constructor() {
    this.vocabulary = new Map(); // token -> featureIndex
    this.featureNames = [];      // featureIndex -> token
    this.idf = [];               // featureIndex -> IDF value
    this.bookVectors = new Map(); // bookId -> Float32Array (normalized)
    this.booksCatalog = new Map(); // bookId -> bookMetadata
    this.pairwiseSimilarity = new Map(); // bookId -> Array of { bookId, score }
    this.isTrained = false;
    this.trainedAt = null;

    // Comprehensive English Stopwords
    this.stopwords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
      'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
      'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t',
      'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for',
      'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having',
      'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him',
      'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in',
      'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
      'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
      'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t',
      'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
      'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
      'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
      'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
      'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s',
      'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom',
      'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
      'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'book', 'books',
      'read', 'reading', 'novel', 'story', 'tales'
    ]);
  }

  /**
   * Tokenizes and normalizes text into unigrams and bigrams
   */
  tokenize(text, includeBigrams = true) {
    if (!text || typeof text !== 'string') return [];
    
    // Lowercase and remove punctuation except apostrophes in words
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

    const rawTokens = clean.split(/\s+/).filter(token => token.length > 2 && !this.stopwords.has(token));
    const tokens = [...rawTokens];

    if (includeBigrams && rawTokens.length > 1) {
      for (let i = 0; i < rawTokens.length - 1; i++) {
        tokens.push(`${rawTokens[i]}_${rawTokens[i + 1]}`);
      }
    }

    return tokens;
  }

  /**
   * Train (fit) the TF-IDF vectorizer and build book feature vectors
   * @param {Array} books Array of book records from MySQL
   */
  fit(books) {
    if (!books || !books.length) {
      console.warn('[ML Model] No books provided for training.');
      return;
    }

    const startTime = Date.now();
    this.booksCatalog.clear();
    this.vocabulary.clear();
    this.featureNames = [];
    this.bookVectors.clear();
    this.pairwiseSimilarity.clear();

    const documents = [];
    const docFrequencies = new Map();

    // 1. Process documents with weighted fields:
    // Title (3x), Genre (2.5x), Author (2x), Description (1x)
    for (const book of books) {
      this.booksCatalog.set(book.BookID, book);

      const titleTokens = this.tokenize(book.Title);
      const genreTokens = this.tokenize(book.GenreName || '');
      const authorTokens = this.tokenize(book.Author || '');
      const descTokens = this.tokenize(book.Description || '');

      const termCounts = new Map();

      const addTerms = (tokens, weight) => {
        for (const token of tokens) {
          termCounts.set(token, (termCounts.get(token) || 0) + weight);
        }
      };

      addTerms(titleTokens, 3.0);
      addTerms(genreTokens, 2.5);
      addTerms(authorTokens, 2.0);
      addTerms(descTokens, 1.0);

      // Track document frequency (unique per document)
      for (const token of termCounts.keys()) {
        docFrequencies.set(token, (docFrequencies.get(token) || 0) + 1);
      }

      documents.push({
        bookId: book.BookID,
        termCounts
      });
    }

    // 2. Build vocabulary index (filter terms appearing at least once)
    let featureIndex = 0;
    for (const [token, df] of docFrequencies.entries()) {
      this.vocabulary.set(token, featureIndex);
      this.featureNames.push(token);
      featureIndex++;
    }

    const N = documents.length;
    const numFeatures = this.featureNames.length;
    this.idf = new Float32Array(numFeatures);

    // 3. Compute smoothed IDF: ln((1 + N) / (1 + df)) + 1
    for (let i = 0; i < numFeatures; i++) {
      const token = this.featureNames[i];
      const df = docFrequencies.get(token) || 1;
      this.idf[i] = Math.log((1 + N) / (1 + df)) + 1.0;
    }

    // 4. Compute L2-normalized TF-IDF vector for each book
    for (const doc of documents) {
      const vector = new Float32Array(numFeatures);
      let normSq = 0;

      for (const [token, tf] of doc.termCounts.entries()) {
        const idx = this.vocabulary.get(token);
        if (idx !== undefined) {
          // Sublinear TF scaling: (1 + ln(tf)) * IDF
          const tfWeight = 1.0 + Math.log(tf);
          const val = tfWeight * this.idf[idx];
          vector[idx] = val;
          normSq += val * val;
        }
      }

      // L2 Normalize
      const norm = Math.sqrt(normSq);
      if (norm > 0) {
        for (let i = 0; i < numFeatures; i++) {
          vector[i] /= norm;
        }
      }

      this.bookVectors.set(doc.bookId, vector);
    }

    // 5. Precompute pairwise book-to-book cosine similarity matrix
    for (const [id1, vec1] of this.bookVectors.entries()) {
      const sims = [];
      for (const [id2, vec2] of this.bookVectors.entries()) {
        if (id1 === id2) continue;
        const sim = this.cosineSimilarity(vec1, vec2);
        if (sim > 0.05) {
          sims.push({ bookId: id2, score: sim });
        }
      }
      sims.sort((a, b) => b.score - a.score);
      this.pairwiseSimilarity.set(id1, sims);
    }

    this.isTrained = true;
    this.trainedAt = new Date().toISOString();
    const duration = Date.now() - startTime;
    console.log(`[ML Model] Trained successfully on ${N} books | Vocabulary: ${numFeatures} features in ${duration}ms.`);
  }

  /**
   * Vectorize arbitrary text (e.g. search query or topic) into the model's feature space
   */
  vectorizeText(text) {
    if (!this.isTrained) return null;
    const tokens = this.tokenize(text);
    const vector = new Float32Array(this.featureNames.length);
    if (!tokens.length) return vector;

    const termCounts = new Map();
    for (const t of tokens) {
      termCounts.set(t, (termCounts.get(t) || 0) + 1);
    }

    let normSq = 0;
    for (const [token, count] of termCounts.entries()) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        const val = (1.0 + Math.log(count)) * this.idf[idx];
        vector[idx] = val;
        normSq += val * val;
      }
    }

    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Cosine similarity between two unit vectors is simply the dot product
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, dot);
  }

  /**
   * Find top overlapping keyword features between a query/profile vector and a book vector
   */
  getTopMatchingKeywords(vectorA, vectorB, topN = 3) {
    if (!vectorA || !vectorB) return [];
    const matches = [];

    for (let i = 0; i < vectorA.length; i++) {
      if (vectorA[i] > 0 && vectorB[i] > 0) {
        const contribution = vectorA[i] * vectorB[i];
        matches.push({
          term: this.featureNames[i].replace('_', ' '),
          weight: contribution
        });
      }
    }

    matches.sort((a, b) => b.weight - a.weight);
    return matches.slice(0, topN).map(m => m.term);
  }

  /**
   * Generate personalized recommendations based on:
   * 1. Recent Searches (query text + timestamp)
   * 2. Recent Reads (bookId + timestamp + completionPct)
   *
   * @param {Object} params
   * @param {Array} params.searches Array of { query, timestamp }
   * @param {Array} params.recentReads Array of { bookId, lastAccessed, completionPct }
   * @param {number} params.limit Max recommendations to return (default 6)
   * @returns {Array} Ranked recommendations with confidence scores & explanations
   */
  predict({ searches = [], recentReads = [], limit = 6, excludeRead = true }) {
    if (!this.isTrained || this.bookVectors.size === 0) {
      return [];
    }

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const numFeatures = this.featureNames.length;

    // Vectors to blend
    const searchProfileVector = new Float32Array(numFeatures);
    const readProfileVector = new Float32Array(numFeatures);

    const activeReadBookIds = new Set();
    const readBookExplanations = new Map();
    const searchExplanations = [];

    // -------------------------------------------------------------
    // 1. Process Recent Searches with Exponential Recency Decay
    // -------------------------------------------------------------
    let totalSearchWeight = 0;
    if (Array.isArray(searches) && searches.length > 0) {
      // Sort newest first
      const sortedSearches = [...searches].sort((a, b) => new Date(b.timestamp || now) - new Date(a.timestamp || now));
      
      for (let i = 0; i < Math.min(sortedSearches.length, 10); i++) {
        const item = sortedSearches[i];
        const queryText = (item.query || item.SearchQuery || '').trim();
        if (!queryText) continue;

        const ageDays = Math.max(0, (now - new Date(item.timestamp || item.CreatedAt || now).getTime()) / dayMs);
        // Half-life of 5 days for searches
        const decayWeight = Math.exp(-0.138 * ageDays) * (1.0 / (1.0 + i * 0.15));

        const queryVec = this.vectorizeText(queryText);
        if (queryVec) {
          for (let f = 0; f < numFeatures; f++) {
            searchProfileVector[f] += queryVec[f] * decayWeight;
          }
          totalSearchWeight += decayWeight;
          if (searchExplanations.length < 3) {
            searchExplanations.push(queryText);
          }
        }
      }
    }

    // Normalize search vector
    if (totalSearchWeight > 0) {
      let normSq = 0;
      for (let f = 0; f < numFeatures; f++) normSq += searchProfileVector[f] * searchProfileVector[f];
      const norm = Math.sqrt(normSq);
      if (norm > 0) {
        for (let f = 0; f < numFeatures; f++) searchProfileVector[f] /= norm;
      }
    }

    // -------------------------------------------------------------
    // 2. Process Recent Reads with Completion & Recency Weighting
    // -------------------------------------------------------------
    let totalReadWeight = 0;
    if (Array.isArray(recentReads) && recentReads.length > 0) {
      const sortedReads = [...recentReads].sort((a, b) => new Date(b.lastAccessed || now) - new Date(a.lastAccessed || now));

      for (let i = 0; i < Math.min(sortedReads.length, 8); i++) {
        const item = sortedReads[i];
        const bId = Number(item.bookId || item.BookID);
        if (!bId) continue;

        activeReadBookIds.add(bId);
        const bookVec = this.bookVectors.get(bId);
        if (!bookVec) continue;

        const bookMeta = this.booksCatalog.get(bId);
        if (bookMeta) {
          readBookExplanations.set(bId, bookMeta.Title);
        }

        const ageDays = Math.max(0, (now - new Date(item.lastAccessed || item.LastAccessed || now).getTime()) / dayMs);
        // Half-life of 10 days for reading history
        const recencyDecay = Math.exp(-0.069 * ageDays);

        const completionPct = parseFloat(item.completionPct || item.CompletionPct || 0);
        // High engagement bonus (users who read > 20% liked it, finished books get full weight)
        const engagementFactor = 0.4 + 0.6 * Math.min(1.0, completionPct / 100);

        const weight = recencyDecay * engagementFactor;

        for (let f = 0; f < numFeatures; f++) {
          readProfileVector[f] += bookVec[f] * weight;
        }
        totalReadWeight += weight;
      }
    }

    // Normalize read vector
    if (totalReadWeight > 0) {
      let normSq = 0;
      for (let f = 0; f < numFeatures; f++) normSq += readProfileVector[f] * readProfileVector[f];
      const norm = Math.sqrt(normSq);
      if (norm > 0) {
        for (let f = 0; f < numFeatures; f++) readProfileVector[f] /= norm;
      }
    }

    // -------------------------------------------------------------
    // 3. Adaptive Blending: User Composite Vector
    // -------------------------------------------------------------
    const compositeUserVector = new Float32Array(numFeatures);
    let hasSignal = false;

    let alpha = 0.5; // Reads weight
    let beta = 0.5;  // Searches weight

    if (totalReadWeight > 0 && totalSearchWeight > 0) {
      alpha = 0.55;
      beta = 0.45;
      hasSignal = true;
    } else if (totalReadWeight > 0) {
      alpha = 1.0;
      beta = 0.0;
      hasSignal = true;
    } else if (totalSearchWeight > 0) {
      alpha = 0.0;
      beta = 1.0;
      hasSignal = true;
    }

    if (hasSignal) {
      for (let f = 0; f < numFeatures; f++) {
        compositeUserVector[f] = alpha * readProfileVector[f] + beta * searchProfileVector[f];
      }
      let normSq = 0;
      for (let f = 0; f < numFeatures; f++) normSq += compositeUserVector[f] * compositeUserVector[f];
      const norm = Math.sqrt(normSq);
      if (norm > 0) {
        for (let f = 0; f < numFeatures; f++) compositeUserVector[f] /= norm;
      }
    }

    // Track author and genre affinities from read history
    const readAuthors = new Map();
    const readGenres = new Map();
    for (const [rId, title] of readBookExplanations.entries()) {
      const rb = this.booksCatalog.get(rId);
      if (rb) {
        if (rb.Author && rb.Author !== 'Unknown') {
          readAuthors.set(rb.Author.toLowerCase(), (readAuthors.get(rb.Author.toLowerCase()) || 0) + 1);
        }
        if (rb.GenreName) {
          readGenres.set(rb.GenreName.toLowerCase(), (readGenres.get(rb.GenreName.toLowerCase()) || 0) + 1);
        }
      }
    }

    // -------------------------------------------------------------
    // 4. Candidate Scoring & Ranking
    // -------------------------------------------------------------
    const scoredBooks = [];

    for (const [candidateId, candidateVec] of this.bookVectors.entries()) {
      if (excludeRead && activeReadBookIds.has(candidateId)) continue;

      const book = this.booksCatalog.get(candidateId);
      if (!book) continue;

      let contentScore = 0;
      let searchSim = 0;
      let readSim = 0;

      if (hasSignal) {
        contentScore = this.cosineSimilarity(compositeUserVector, candidateVec);
        if (totalSearchWeight > 0) searchSim = this.cosineSimilarity(searchProfileVector, candidateVec);
        if (totalReadWeight > 0) readSim = this.cosineSimilarity(readProfileVector, candidateVec);
      } else {
        // Cold start fallback: blend view count & general appeal
        contentScore = 0.25;
      }

      // Author & Genre affinity bonuses
      let authorBonus = 0;
      let genreBonus = 0;
      if (book.Author && readAuthors.has(book.Author.toLowerCase())) {
        authorBonus = 0.25;
      }
      if (book.GenreName && readGenres.has(book.GenreName.toLowerCase())) {
        genreBonus = 0.18;
      }

      // Popularity prior: log(1 + ViewCount) / 10
      const views = book.ViewCount || 0;
      const popularityBonus = Math.min(0.12, Math.log10(1 + views) * 0.05);

      // Novelty penalty if already read (when not excluded)
      const isAlreadyRead = activeReadBookIds.has(candidateId);
      const noveltyDiscount = isAlreadyRead ? 0.60 : 0.0;

      // Final composite score
      const finalScore = (contentScore * 0.70) + (authorBonus * 0.15) + (genreBonus * 0.12) + popularityBonus - noveltyDiscount;

      // Find best explanation
      let reason = 'Curated pick from Lumina catalogue';
      let primarySource = 'catalog';

      // Find which specific read book has highest pairwise similarity with this candidate
      let bestPairTitle = '';
      let bestPairScore = 0;
      for (const [readId, title] of readBookExplanations.entries()) {
        const pairSim = this.cosineSimilarity(this.bookVectors.get(readId), candidateVec);
        if (pairSim > bestPairScore) {
          bestPairScore = pairSim;
          bestPairTitle = title;
        }
      }

      if (searchSim > 0.04 && searchExplanations.length > 0) {
        reason = `Matches your recent search for "${searchExplanations[0]}"`;
        primarySource = 'search';
      } else if (authorBonus > 0) {
        reason = `More by ${book.Author}`;
        primarySource = 'author';
      } else if (bestPairScore > 0.015 && bestPairTitle) {
        reason = `Because you read "${bestPairTitle}"`;
        primarySource = 'reads';
      } else if (genreBonus > 0 && book.GenreName) {
        reason = `Top choice in ${book.GenreName}`;
        primarySource = 'genre';
      } else if (book.GenreName) {
        reason = `Popular in ${book.GenreName}`;
        primarySource = 'genre';
      }

      // Matching keywords
      const matchedKeywords = this.getTopMatchingKeywords(
        hasSignal ? compositeUserVector : candidateVec,
        candidateVec,
        3
      );

      // Calculate match percentage (scaled 72% - 98% for realistic UX)
      const rawAffinity = contentScore * 1.5 + authorBonus + genreBonus + popularityBonus;
      const matchPct = hasSignal
        ? Math.min(99, Math.max(72, Math.round(74 + rawAffinity * 35)))
        : Math.min(94, Math.max(72, Math.round(75 + popularityBonus * 120)));

      scoredBooks.push({
        book,
        score: Math.max(0.001, finalScore),
        matchPercentage: matchPct,
        reason,
        source: primarySource,
        matchedKeywords,
        isAlreadyRead
      });
    }

    // Sort by match percentage and final score descending
    scoredBooks.sort((a, b) => (b.matchPercentage - a.matchPercentage) || (b.score - a.score));

    // Return top N
    return scoredBooks.slice(0, limit).map(item => ({
      ...item.book,
      recommendationScore: parseFloat(item.score.toFixed(4)),
      matchPercentage: item.matchPercentage,
      reason: item.reason,
      recommendationSource: item.source,
      matchedKeywords: item.matchedKeywords,
      isAlreadyRead: item.isAlreadyRead
    }));
  }

  /**
   * Health and metadata summary of the model
   */
  getInfo() {
    return {
      status: this.isTrained ? 'ready' : 'uninitialized',
      trainedAt: this.trainedAt,
      booksIndexed: this.bookVectors.size,
      vocabularyFeatures: this.featureNames.length,
      sampleFeatures: this.featureNames.slice(0, 15),
      architecture: 'TF-IDF Vector Space Model with Cosine Similarity, Exponential Recency Decay & Behavioral Blending'
    };
  }
}

// Export singleton instance
const recommendationModel = new RecommendationModel();
module.exports = recommendationModel;
