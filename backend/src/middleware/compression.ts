/**
 * Response Compression Middleware
 * Implements Brotli/Gzip compression for API responses
 */

import { Context, Next } from 'hono';
import { brotliCompressSync, gzipSync } from 'zlib';

interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (0-11 for Brotli, 0-9 for Gzip)
  preferBrotli?: boolean; // Prefer Brotli over Gzip when available
}

const DEFAULT_OPTIONS: CompressionOptions = {
  threshold: 1024, // 1KB
  level: 6, // Balanced compression
  preferBrotli: true
};

export function compression(options: CompressionOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return async (c: Context, next: Next) => {
    await next();
    
    // Only compress successful responses
    if (c.res.status >= 400) {
      return;
    }
    
    // Get response body
    const body = await c.res.clone().text();
    
    // Skip compression for small responses
    if (body.length < opts.threshold!) {
      return;
    }
    
    // Check Accept-Encoding header
    const acceptEncoding = c.req.header('Accept-Encoding') || '';
    
    let compressedBody: Buffer | null = null;
    let encoding: string | null = null;
    
    // Try Brotli first if supported and preferred
    if (opts.preferBrotli && acceptEncoding.includes('br')) {
      try {
        compressedBody = brotliCompressSync(Buffer.from(body));
        encoding = 'br';
      } catch (error) {
        // Fall through to Gzip
      }
    }
    
    // Try Gzip if Brotli not available or failed
    if (!compressedBody && acceptEncoding.includes('gzip')) {
      try {
        compressedBody = gzipSync(Buffer.from(body), {
          level: Math.min(opts.level!, 9)
        });
        encoding = 'gzip';
      } catch (error) {
        // Leave uncompressed
      }
    }
    
    // Apply compression if successful
    if (compressedBody && encoding) {
      // Calculate compression ratio
      const ratio = ((1 - compressedBody.length / body.length) * 100).toFixed(1);
      
      c.header('Content-Encoding', encoding);
      c.header('Content-Length', compressedBody.length.toString());
      c.header('Vary', 'Accept-Encoding');
      c.header('X-Compression-Ratio', ratio + '%');
      
      // Replace response body
      const contentType = c.res.headers.get('Content-Type') || 'application/json';
      return new Response(compressedBody, {
        status: c.res.status,
        headers: {
          'Content-Type': contentType,
          'Content-Encoding': encoding,
          'Content-Length': compressedBody.length.toString(),
          'Vary': 'Accept-Encoding',
          'X-Compression-Ratio': ratio + '%'
        }
      });
    }
  };
}

/**
 * Streaming compression for large responses
 * Useful for file downloads or large dataset exports
 */
export function streamCompression() {
  return async (c: Context, next: Next) => {
    const acceptEncoding = c.req.header('Accept-Encoding') || '';
    
    if (acceptEncoding.includes('gzip') || acceptEncoding.includes('br')) {
      c.header('Content-Encoding', acceptEncoding.includes('br') ? 'br' : 'gzip');
      c.header('Vary', 'Accept-Encoding');
    }
    
    await next();
  };
}
