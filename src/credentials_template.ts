export class Credentials {

  static readonly SERVER_HASH_SALT: string = '<fill in>';
  static readonly CLIENT_HASH_SALT: string = '<fill in>';
  static readonly COOKIE_SIGN_KEY: string = '<fill in>';

  static readonly DATABASE_HOST: string = '<fill in>';
  static readonly DATABASE_PORT: number = 3306;
  static readonly DATABASE_NAME: string = '<fill in>';
  static readonly DATABASE_USER: string = '<fill in>';
  static readonly DATABASE_PASSWORD: string = '<fill in>';

  static readonly OAUTH_CREDENTIALS: { [key:string]: {
    'client_id': string, 
    'client_secret': string
  } } = {

    'oura': {
      'client_id': '<fill in>',
      'client_secret': '<fill in>'
    }

  };

}