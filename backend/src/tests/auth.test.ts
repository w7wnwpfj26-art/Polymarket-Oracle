/**
 * Authentication & Security Tests
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signJWT, verifyJWT } from '../middleware/auth';

describe('Auth Security', () => {
  describe('Password Hashing', () => {
    it('should hash a password and verify correctly', () => {
      const password = 'MySecureP@ss123';
      const hash = hashPassword(password);

      expect(hash).toContain(':');
      expect(hash.length).toBeGreaterThan(32);
      expect(verifyPassword(password, hash)).toBe(true);
    });

    it('should reject wrong password', () => {
      const hash = hashPassword('CorrectPassword');
      expect(verifyPassword('WrongPassword', hash)).toBe(false);
    });

    it('should generate different hashes for same password (unique salt)', () => {
      const password = 'SamePassword';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
    });

    it('should reject malformed hash', () => {
      expect(verifyPassword('test', 'invalid-hash')).toBe(false);
      expect(verifyPassword('test', '')).toBe(false);
    });
  });

  describe('JWT', () => {
    it('should sign and verify a JWT token', () => {
      const token = signJWT({ sub: 'testuser', role: 'admin' }, 3600);
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3);

      const payload = verifyJWT(token);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('testuser');
      expect(payload!.role).toBe('admin');
    });

    it('should reject tampered token', () => {
      const token = signJWT({ sub: 'user', role: 'user' });
      // Tamper with the payload
      const parts = token.split('.');
      parts[1] = parts[1] + 'x';
      const tampered = parts.join('.');

      expect(verifyJWT(tampered)).toBeNull();
    });

    it('should reject expired token', () => {
      // Sign with -1 second expiry (already expired)
      const token = signJWT({ sub: 'user', role: 'user' }, -1);
      expect(verifyJWT(token)).toBeNull();
    });

    it('should reject malformed token', () => {
      expect(verifyJWT('not.a.token')).toBeNull();
      expect(verifyJWT('')).toBeNull();
      expect(verifyJWT('abc')).toBeNull();
    });
  });
});
