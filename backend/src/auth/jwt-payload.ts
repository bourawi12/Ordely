export interface JwtPayload {
  sub: number;
  email: string;
}

/** What AuthGuard puts on the request: the token payload plus the user's shop, read from the database. */
export interface AuthUser extends JwtPayload {
  boutiqueId: number;
}
