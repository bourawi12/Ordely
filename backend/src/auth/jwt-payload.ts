export interface JwtPayload {
  sub: number;
  email: string;
  /** Issued at (seconds), added by the JWT library when signing. */
  iat?: number;
}

/**
 * What AuthGuard puts on the request: the token payload plus the user's shop and role, read
 * from the database on every request (a revoked admin loses access at once).
 */
export interface AuthUser extends JwtPayload {
  boutiqueId: number;
  isPlatformAdmin: boolean;
}
