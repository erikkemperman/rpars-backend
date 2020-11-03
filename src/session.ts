// -- Authentication, mostly based on SCRAM --
// https://tools.ietf.org/html/rfc5802
// https://en.wikipedia.org/wiki/Salted_Challenge_Response_Authentication_Mechanism


import * as Koa from 'koa';
import * as crypto from 'crypto';
import * as seedrandom from 'seedrandom';

import { Constants } from './constants';
import * as util from './util';
import { User, Challenge, Session } from './entity';
import { Credentials } from './credentials';
import { Database } from './database';



// Handle session init

export async function session_login_init(ctx: Koa.ParameterizedContext) {
  if (!util.check_parameters(ctx, {
    'email_hash': 'string',
    'client_nonce': 'string',
  })) {
    return;
  }

  // Check if input conforms expectations

  const email_hash = ctx.request.body.email_hash;
  const client_nonce = ctx.request.body.client_nonce;

  if (email_hash.length !== Constants.HASH_LENGTH * 2 || !util.HEX_REX.test(email_hash)) {
    ctx.status = 400;
    ctx.message = `Bad request: email_hash must be a hex string of length ${Constants.HASH_LENGTH * 2}`;
    return;
  }
  if (client_nonce.length !== Constants.NONCE_LENGTH * 2 || !util.HEX_REX.test(client_nonce)) {
    ctx.status = 400;
    ctx.message = `Bad request: client_nonce must be a hex string of length ${Constants.NONCE_LENGTH * 2}`;
    return;
  }

  // Find the corresponding user
  const users: User[] = await ctx.state.db.manager.find(User, { email_hash: email_hash });
  const user: User | null = email_hash !== Database.EMPTY_HASH && users.length === 1 && users[0] || null;

  const noise: seedrandom.prng = bogus_prng(hash(email_hash, Credentials.SERVER_HASH_SALT));
  const bogus_salt: string = random_string_bogus(noise, Constants.NONCE_LENGTH);
  const bogus_iterations: number = random_iterations_bogus(noise, Constants.PASSWORD_ITERATIONS);

  const challenge = new Challenge();
  challenge.client_nonce = client_nonce;
  challenge.server_nonce = random_string(Constants.NONCE_LENGTH);
  challenge.remote_ip = ctx.request.ip;
  challenge.user = user || ctx.state.db.empty_user;
  const expiration = Date.now() + Constants.CHALLENGE_EXPIRATION;
  challenge.expiration = expiration.toString();
  await ctx.state.db.manager.save(challenge);

  const body = {
    client_nonce: challenge.client_nonce,
    server_nonce: challenge.server_nonce,
    challenge_expiration: expiration
  }
  if (user !== null) {
    // User found, return server_nonce, and salt and iterations for pbkdf2
    body['client_salt'] = user.client_salt;
    body['iterations'] = user.iterations;
  } else {
    // User not found, return bogus values
    body['client_salt'] = bogus_salt;
    body['iterations'] = bogus_iterations;
  }

  ctx.response.body = JSON.stringify(body);
}


// Handle session fini

export async function session_login_fini(ctx: Koa.ParameterizedContext) {
  if (!util.check_parameters(ctx, {
    'email_hash': 'string',
    'client_nonce': 'string',
    'server_nonce': 'string',
    'iterations': 'number',
    'challenge_expiration': 'number',
    'client_proof': 'string'
  })) {
    return;
  }

  // Check if input conforms expectations

  const email_hash = ctx.request.body.email_hash;
  const client_nonce = ctx.request.body.client_nonce;
  const server_nonce = ctx.request.body.server_nonce;
  const iterations = ctx.request.body.iterations;
  const expiration = ctx.request.body.challenge_expiration;
  const client_proof = ctx.request.body.client_proof;

  if (email_hash.length !== Constants.HASH_LENGTH * 2 || !util.HEX_REX.test(email_hash)) {
    ctx.status = 400;
    ctx.message = `Bad request: email_hash must be a hex string of length ${Constants.HASH_LENGTH * 2}`;
    return;
  }
  if (client_nonce.length !== Constants.NONCE_LENGTH * 2 || !util.HEX_REX.test(client_nonce)) {
    ctx.status = 400;
    ctx.message = `Bad request: client_nonce must be a hex string of length ${Constants.NONCE_LENGTH * 2}`;
    return;
  }
  if (server_nonce.length !== Constants.NONCE_LENGTH * 2 || !util.HEX_REX.test(server_nonce)) {
    ctx.status = 400;
    ctx.message = `Bad request: server_nonce must be a hex string of length ${Constants.NONCE_LENGTH * 2}`;
    return;
  }
  if (Math.round(iterations) !== iterations || iterations < 0)
  if (client_proof.length !== Constants.HASH_LENGTH * 2 || !util.HEX_REX.test(client_proof)) {
    ctx.status = 400;
    ctx.message = `Bad request: client_proof must be a hex string of length ${Constants.HASH_LENGTH * 2}`;
    return;
  }

  // Retrieve user and challenge
  const users: User[] = await ctx.state.db.manager.find(User, { email_hash: email_hash });
  const user: User = users.length === 1 && users[0] || ctx.state.db.empty_user;

  const challenges = await ctx.state.db.manager.find(Challenge, {
    where: {
      remote_ip: ctx.request.ip,
      client_nonce: client_nonce,
      server_nonce: server_nonce
    },
    relations: ['user']
  });
  const challenge: Challenge | null = challenges.length === 1 && challenges[0] || null;

  // Check if challenge is valid and not yet expired
  if (challenge === null
  || challenge.user.user_id !== user.user_id
  || challenge.expiration !== expiration.toString()) {
    ctx.response.status = 400;
    ctx.response.message = 'Bad request: no matching challenge';
    if (challenge !== null) {
      await ctx.state.db.manager.delete(Challenge, challenge.challenge_id);
    }
    return;
  } else if (Date.now() > parseInt(challenge.expiration)) {
    ctx.response.status = 408;
    ctx.response.message = 'Challenge expired';
    await ctx.state.db.manager.delete(Challenge, challenge.challenge_id);
    return;
  } else {
    await ctx.state.db.manager.delete(Challenge, challenge.challenge_id);
  }

  let pass = challenge.user.email_hash !== Database.EMPTY_HASH;
  let client_salt: string;
  let client_key: string;
  let server_key: string;

  const noise: seedrandom.prng = bogus_prng(Credentials.SERVER_HASH_SALT);
  const bogus_salt: string = random_string_bogus(noise, Constants.HASH_LENGTH);
  const bogus_key: string = random_string_bogus(noise, Constants.HASH_LENGTH);

  if (pass) {
    // Found user, verify credentials
    client_salt = user.client_salt;
    client_key = user.client_key;
    server_key = user.server_key;
    pass = pass && email_hash === user.email_hash && iterations === user.iterations;
  } else {
    // User not found, use bogus values (which will fail). However, we do proceed
    // to actually verify these bogus values to defeat timing attacks trying to
    // determine whether a given email_hash is known.
    client_salt = bogus_salt;
    client_key = bogus_key;
    server_key = bogus_key;
    pass = false;
  }

  // Compute the final auth content, which client and server will mutually
  // prove to another to have knowledge of.
  const auth = `${email_hash},${client_nonce},${server_nonce},${client_salt}`;

  // Verify the client proof
  const proof_bytes = hex_to_array(client_proof);
  const auth_bytes = hex_to_array(hmac(client_key, auth));
  for (let i = 0; i < Constants.HASH_LENGTH; i++) {
    proof_bytes[i] ^= auth_bytes[i];
  }

  // Now, the contents of proof_bytes should equal the client key, so let's
  // hash it and compare against what we have in the database.
  const client_check = hash(array_to_hex(proof_bytes), '');
  pass = pass && client_check === client_key;

  if (!pass) {
    // Credentials invalid
    ctx.response.status = 403;
    ctx.response.message = 'Invalid credentials';
    return;
  }

  const client_session: Session = new Session();
  client_session.user = user;
  client_session.session_token = random_string(Constants.NONCE_LENGTH);
  client_session.expiration = (Date.now() + Constants.SESSION_EXPIRATION).toString();
  ctx.state.db.manager.save(client_session);
  ctx.response.body = JSON.stringify({
    server_proof: hmac(server_key, auth),
    session_id: client_session.session_token,
    expiration: Constants.SESSION_EXPIRATION,
    admin: user.admin
  });
}

// Handle session logout

export async function session_logout(ctx: Koa.ParameterizedContext) {
  const sess: Session = await check_session(ctx) || null;
  if (sess !== null) {
    await ctx.state.db.manager.delete(Session, sess.session_id);
  }
  ctx.response.body = JSON.stringify({
    session_id: '',
    expiration: 0
  });
}

// -- Helper functions --

export async function check_session(ctx: Koa.ParameterizedContext, session_id?: string): Promise<Session> {
  session_id = session_id || ctx.get('Authorization');
  const session: Session = session_id && await ctx.state.db.manager.findOne(Session, {
    where: { session_token: session_id },
    relations: ['user']
  }) || null;

  if (session === null || parseInt(session.expiration) < Date.now()) {
    ctx.response.status = 401;
    ctx.response.message = 'Unauthorized';
    return null;
  } else {
    session.expiration = (Date.now() + Constants.SESSION_EXPIRATION).toString();
    await ctx.state.db.manager.save(Session, session);
  }
  return session;
}


export function random_string(bytes: number, encoding?: BufferEncoding): string {
  if (!encoding) {
    encoding = 'hex';
  }
  return crypto.randomBytes(bytes).toString(encoding);
}

export function random_float(): number {
  return crypto.randomBytes(4).readUInt32LE(0) / 0xffff_ffff;
}

export function random_iterations(iterations?: number): number {
  if (!iterations) {
    iterations = Constants.PASSWORD_ITERATIONS;
  }
  const iterations_rnd = random_float() - 0.5;
  const iterations_offset = 1.0 + (Constants.PASSWORD_ITERATIONS_FLEX * iterations_rnd);
  return Math.round(iterations * iterations_offset);
}

export function pbkdf2(password: string, salt: string, iterations: number,
    encoding?: BufferEncoding): string {
  if (!encoding) {
    encoding = 'hex';
  }
  return crypto.pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    Buffer.from(salt, 'utf8'),
    iterations,
    Constants.PASSWORD_LENGTH,
    Constants.PASSWORD_ALGORITHM
  ).toString(encoding);
}

export function hmac(secret: string, message: string,
   encoding?: crypto.HexBase64Latin1Encoding): string {
  if (!encoding) {
    encoding = 'hex';
  }
  const hmac = crypto.createHmac(Constants.HASH_ALGORITHM, secret);
  hmac.update(message, 'utf8');
  return hmac.digest(encoding);
}

export function hash(message: string, salt: string,
    encoding?: crypto.HexBase64Latin1Encoding): string {
  if (!encoding) {
    encoding = 'hex';
  }
  const hash = crypto.createHash(Constants.HASH_ALGORITHM);
  hash.update(message + salt, 'utf8');
  return hash.digest(encoding);
}

export function bogus_prng(seed: string): seedrandom.prng {
  return seedrandom(hash(seed, Credentials.SERVER_HASH_SALT));
}

export function random_string_bogus(src: seedrandom.prng,
    bytes: number, encoding?: BufferEncoding): string {
  if (!encoding) {
    encoding = 'hex';
  }
  const buf: Uint8Array = new Uint8Array(bytes);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = src.int32() & 0xff;
  }
  return Buffer.from(buf).toString(encoding);
}

export function random_float_bogus(src: seedrandom.prng): number {
  return src.double();
}

export function random_iterations_bogus(src: seedrandom.prng, iterations?: number): number {
  if (!iterations) {
    iterations = Constants.PASSWORD_ITERATIONS;
  }
  const iterations_rnd = random_float_bogus(src) - 0.5;
  const iterations_offset = 1.0 + (Constants.PASSWORD_ITERATIONS_FLEX * iterations_rnd);
  return Math.round(iterations * iterations_offset);
}

export function hex_to_array(hex: string): Uint8Array {
  const array = new Uint8Array(hex.length / 2);
  for (let i = 0; i < array.length; i++) {
    let val = hex.substr(i * 2, 2);
    array[i] = parseInt(val, 16);
  }
  return array;
}

export function array_to_hex(array: Uint8Array): string {
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
}
