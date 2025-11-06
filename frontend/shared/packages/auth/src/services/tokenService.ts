/**
 * JWT Token Service
 * Handles JWT token creation, validation, and decoding
 * Integrates with DotMac backend auth system
 */

import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { User, AuthTokens, PortalType } from "../types";
import { getAuthSecurity } from "../config/authSettings";

export interface TokenPayload {
  userId: string;
  email: string;
  tenantId: string;
  portalType: PortalType;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  sessionId?: string;
}

export class TokenService {
  private static getConfig() {
    return getAuthSecurity();
  }

  /**
   * Create JWT access and refresh tokens for authenticated user
   */
  static createTokens(
    user: User,
    portalType: PortalType,
    securityContext?: SecurityContext,
  ): AuthTokens {
    const config = this.getConfig();
    const now = Math.floor(Date.now() / 1000);

    const payload: Omit<TokenPayload, "iat" | "exp" | "iss" | "aud"> = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      portalType,
      role: user.role,
      permissions: user.permissions,
    };

    const accessTokenOptions: SignOptions = {
      expiresIn: config.accessTokenExpiry,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      subject: user.id,
    };

    const accessToken = jwt.sign(
      {
        ...payload,
        type: "access",
        ctx: securityContext,
      },
      config.jwtSecret,
      accessTokenOptions,
    );

    const refreshTokenOptions: SignOptions = {
      expiresIn: config.refreshTokenExpiry,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      subject: user.id,
    };

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        portalType,
        type: "refresh",
      },
      config.jwtRefreshSecret,
      refreshTokenOptions,
    );

    // Calculate expiration timestamp
    const decodedPayload = jwt.decode(accessToken);
    const expiresAt =
      decodedPayload && typeof decodedPayload !== "string" && decodedPayload.exp
        ? decodedPayload.exp * 1000
        : 0;

    return {
      accessToken,
      refreshToken,
      expiresAt,
      tokenType: "Bearer",
    };
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string, type: "access" | "refresh" = "access"): TokenPayload | null {
    try {
      const config = this.getConfig();
      const secret = type === "access" ? config.jwtSecret : config.jwtRefreshSecret;

      const decoded = jwt.verify(token, secret, {
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      }) as jwt.JwtPayload & Partial<TokenPayload>;

      // Verify token type matches expected
      if (decoded.type !== type) {
        throw new Error(`Invalid token type. Expected ${type}, got ${decoded.type}`);
      }

      // Validate required fields
      if (!decoded.userId || !decoded.tenantId || !decoded.portalType) {
        throw new Error("Missing required token fields");
      }

      return {
        userId: decoded.userId!,
        email: decoded.email || "",
        tenantId: decoded.tenantId!,
        portalType: decoded.portalType as PortalType,
        role: decoded.role || "",
        permissions: decoded.permissions || [],
        iat: decoded.iat!,
        exp: decoded.exp!,
        iss: decoded.iss!,
        aud: decoded.aud!,
      };
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  /**
   * Extract token from Authorization header or cookie
   */
  static extractTokenFromRequest(request: Request): string | null {
    // Try Authorization header first
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // Try cookie (for web browsers)
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
      const config = this.getConfig();
      const cookies = cookieHeader.split(";").reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split("=");
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

      return cookies[config.cookieName] || cookies["auth-token"] || null;
    }

    return null;
  }

  /**
   * Get security context from request
   */
  static getSecurityContext(request: Request): SecurityContext {
    return {
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        request.headers.get("remote-addr") ||
        "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      timestamp: Date.now(),
      sessionId: request.headers.get("x-session-id") || undefined,
    };
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded.exp) return true;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): number {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      return (decoded.exp || 0) * 1000;
    } catch {
      return 0;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    getUserById: (userId: string, tenantId: string) => Promise<User | null>,
  ): Promise<AuthTokens | null> {
    const payload = this.verifyToken(refreshToken, "refresh");
    if (!payload) return null;

    // Get current user data
    const user = await getUserById(payload.userId, payload.tenantId);
    if (!user) return null;

    // Create new tokens
    return this.createTokens(user, payload.portalType);
  }
}
