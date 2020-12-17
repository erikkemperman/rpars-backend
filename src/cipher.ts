import * as Koa from 'koa';

import * as session from './session';
import * as util from './util';
import { User, Session, Key } from './entity';
import { Constants } from './constants';

export async function key_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_session(ctx) || null;
  if (sess === null) {
    return;
  }
  const keys: Key[] = await sess.user.keys;
  ctx.response.body = JSON.stringify(keys.map((key) => { return {
    key_id: key.key_id,
    public_key: key.public_key,
    expiration: Constants.SESSION_EXPIRATION
  }}));
}

export async function key_set(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_session(ctx) || null;
  if (sess === null) {
    return;
  }

  if (!util.check_parameters(ctx, {
    'public_key': 'string'
  })) {
    return;
  }

  const public_key = ctx.request.body.public_key;

  if (public_key.length === 0 || !util.HEX_REX.test(public_key)) {
    ctx.status = 400;
    ctx.message = `Bad request: email_hash must be a non-empty hex string`;
    return;
  }

  const key: Key = new Key();
  key.user = sess.user;
  key.public_key = public_key;
  await ctx.state.db.manager.save(key);

  ctx.response.body =  JSON.stringify({
    key_id: key.key_id,
    expiration: Constants.SESSION_EXPIRATION
  });
}