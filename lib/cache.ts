/**
 * Cache utility for document preview and data caching
 * This helps reduce API calls and improves performance for document previews
 */

// Define cache entry type
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// Simple in-memory cache implementation
class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) { // Default 5 minutes TTL
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Get an item from cache
   * @param key The cache key
   * @returns The cached data or null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if the entry has expired
    const now = Date.now();
    if (now > entry.expiry) {
      this.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set an item in the cache
   * @param key The cache key
   * @param data The data to cache
   * @param ttlMs Optional time-to-live in milliseconds
   */
  set(key: string, data: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs || this.defaultTtl);
    this.cache.set(key, { data, expiry });
  }

  /**
   * Delete an item from the cache
   * @param key The cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Prune expired items from the cache
   */
  prune(): void {
    const now = Date.now();
    // Use Array.from to convert the iterator to an array to avoid TypeScript iterator issues
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

// Create document preview cache instance
export const documentPreviewCache = new Cache<string>(30 * 60 * 1000); // 30 minutes TTL

// Create document data cache instance
export const documentDataCache = new Cache<any>(15 * 60 * 1000); // 15 minutes TTL

// Create template cache instance
export const templateCache = new Cache<any>(60 * 60 * 1000); // 60 minutes TTL

/**
 * Fetch data with caching
 * @param key Cache key
 * @param fetchFn Function to fetch data if not in cache
 * @param cache Cache instance to use
 * @param ttlMs Optional TTL override
 * @returns The fetched or cached data
 */
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  cache: Cache<T>,
  ttlMs?: number
): Promise<T> {
  // Try to get from cache first
  const cachedData = cache.get(key);
  if (cachedData !== null) {
    return cachedData;
  }

  // If not in cache, fetch the data
  const data = await fetchFn();
  
  // Store in cache
  cache.set(key, data, ttlMs);
  
  return data;
}

// Setup automatic cache pruning every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    documentPreviewCache.prune();
    documentDataCache.prune();
    templateCache.prune();
  }, 60 * 1000);
}

export default {
  documentPreviewCache,
  documentDataCache,
  templateCache,
  fetchWithCache
}; 