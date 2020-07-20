import { Database } from './database';
import { Constants } from './constants';
import { Credentials } from './credentials'
import * as session from './session'

import { User, Session } from './entity';

Database.create().then(async (db: Database) => {
  for (let email of process.argv.slice(2)) {
    let password = session.random_string(12, 'base64');;
    const creds = email.split('=');
    if (creds.length > 1) {
      password = creds.pop();
      email = creds.join('');
    }
    const user = new User();
    user.email_hash = session.hash(email, Credentials.CLIENT_HASH_SALT);
    user.client_salt = session.random_string(Constants.NONCE_LENGTH);
    user.iterations = session.random_iterations(Constants.PASSWORD_ITERATIONS);

    const password_hash = session.pbkdf2(password, user.client_salt, user.iterations);
    const client_key = session.hmac(password_hash, 'Client Key');
    user.client_key = session.hash(client_key, '');
    user.server_key = session.hmac(password_hash, 'Server Key');
    user.sessions = Promise.resolve([]);

    await db.manager.save(user);
    console.log('Saved user');
    console.log(`  id: ${user.user_id}`);
    console.log(`  email: ${email}`);
    console.log(`  password: ${password}`);
    console.log('');
  }

  db.fini();
  console.log('Done');
  process.exit(0);
});
