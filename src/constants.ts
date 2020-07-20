export class Constants {

  static readonly HTTP_PORT: number = 8080;
  static readonly HTTPS_PORT: number = 8086;

  static readonly COOKIE_PREFIX: string = 'rpars_';
  static readonly COOKIE_SESSION_ID: string = Constants.COOKIE_PREFIX + 'session_id';
  static readonly COOKIE_SIGN_ALGORITHM: string = 'sha512';

  static readonly HASH_ALGORITHM: string = 'sha512';
  static readonly HASH_LENGTH: number = 64; // bytes
  static readonly NONCE_LENGTH: number = 64; // bytes
  static readonly PASSWORD_ALGORITHM: string = 'sha512';
  static readonly PASSWORD_LENGTH: number = 512; // bytes
  static readonly PASSWORD_ITERATIONS: number = 131_072;
  static readonly PASSWORD_ITERATIONS_FLEX: number = 0.05 // +/- 2.5%;

  static readonly CHALLENGE_EXPIRATION: number = 2 * 60 * 1_000; // 2 minutes
  static readonly SESSION_EXPIRATION: number = 15 * 60 * 1_000; // 15 minutes

  static readonly MAINTENANCE_REQUESTS = 10;
  static readonly MAINTENANCE_MILLIS = 15 * 1_000; // 15 seconds
}