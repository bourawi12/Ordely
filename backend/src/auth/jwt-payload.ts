export interface JwtPayload {
  sub: number;
  email: string;
  /** Issued at (seconds), added by the JWT library when signing. */
  iat?: number;
}

/** What AuthGuard puts on the request: the token payload plus the user's shop, read from the database. */
export interface AuthUser extends JwtPayload {
  boutiqueId: number;
}
