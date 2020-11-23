import * as Koa from 'koa';

import { Constants } from './constants';
import { Credentials } from './credentials';
import { HttpClient } from './httpclient';
import * as session from './session';
import { stringify_query } from './util';

import { Session, User, Key, OAuth, Oura } from './entity';
import { userInfo } from 'os';


const OURA_AUTH_URL: string = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL: string = 'https://api.ouraring.com/oauth/token';
const OURA_API_URL: string = 'https://api.ouraring.com/v1';

export const OAUTH_PROVIDERS: {
  [key: string]: {

    'authorize': {
      (
        ctx: Koa.ParameterizedContext,
        state: string
      ): Promise<void>
    },

    'token': {
      (
        ctx: Koa.ParameterizedContext,
        code: string
      ): Promise<{
        token: string,
        scope: string,
        expire: number | null,
        refresh: string | null
      }>
    }

    'synchronize': {(ctx: Koa.ParameterizedContext, user: User, key: Key, oauth: OAuth, since: string): Promise<object>}
  }
} = {

  'oura': {

    'authorize': async (
      ctx: Koa.ParameterizedContext,
      state: string
    ) => {
      const credentials = Credentials.OAUTH_CREDENTIALS['oura'];
      const client_id = credentials.client_id;
      const url = `${OURA_AUTH_URL}?response_type=code&client_id=${client_id}&state=${state}&scope=personal%20daily`;
      ctx.redirect(url);
    },

    'token': async (
      ctx: Koa.ParameterizedContext,
      code: string
    ) => {
      const credentials = Credentials.OAUTH_CREDENTIALS['oura'];
      const client_id = credentials.client_id;
      const client_secret = credentials.client_secret;
      const query_params = stringify_query({
        grant_type: 'authorization_code',
        code: code,
        client_id: client_id,
        client_secret: client_secret
      });
      //console.log('before post', OURA_TOKEN_URL, query_params);
      const response = await HttpClient.post(OURA_TOKEN_URL, query_params, {
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      );
      const res_data = response.data;
      //console.log('after post', res_data);

      const token: string = res_data.access_token;
      let expire: number | null = null;
      if (typeof res_data.expires_in === 'string') {
        expire = parseInt(res_data.expires_in) * 1000 + Date.now();
      } else if (typeof res_data.expires_in === 'number') {
        expire = res_data.expires_in * 1000 + Date.now();
      }
      let scope: string | null = null
      if (typeof res_data.scope === 'string') {
        scope = res_data.scope;
      } else if (!!res_data.scope) {
        scope = res_data.scope[0];
      }
      let refresh: string | null = null
      if (typeof res_data.refresh_token === 'string') {
        refresh = res_data.refresh_token;
      } else if (!!res_data.refresh_token) {
        refresh = res_data.refresh_token[0];
      }

      return {
        token: token,
        scope: scope,
        expire: expire,
        refresh: refresh
      }
    },

    'synchronize': async (ctx: Koa.ParameterizedContext,
    user: User, key: Key, oauth: OAuth, since: string): Promise<object> => {
      if (parseInt(oauth.expiration) < Date.now()) {
        console.log('Token expired, need to refresh');
        const credentials = Credentials.OAUTH_CREDENTIALS['oura'];
        const client_id = credentials.client_id;
        const client_secret = credentials.client_secret;
        const response = await HttpClient.post(OURA_TOKEN_URL, stringify_query({
          grant_type: 'refresh_token',
          refresh_token: oauth.refresh,
          client_id: client_id,
          client_secret: client_secret
        }), {
            headers: {
              'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
          }
        );
        const res_data = response.data;

        let new_expiration: string;
        let new_token: string;
        let new_refresh: string;

        if (typeof res_data.expires_in === 'string') {
          new_expiration = (parseInt(res_data.expires_in) * 1000 + Date.now()).toString();
        } else if (typeof res_data.expires_in === 'number') {
          new_expiration = (res_data.expires_in * 1000 + Date.now()).toString();
        }
        if (typeof res_data.access_token === 'string') {
          new_token = res_data.access_token;
        } else if (!!res_data.access_token) { // if set it is an array
          new_token = res_data.access_token[0];
        }
        if (typeof res_data.refresh_token === 'string') {
          new_refresh = res_data.refresh_token;
        } else if (!!res_data.refresh_token) { // if set it is an array
          new_refresh = res_data.refresh_token[0];
        }

        for (let save_oauth of await ctx.state.db.manager.find(OAuth, {
          provider: oauth.provider,
          token: oauth.token,
          refresh: oauth.refresh
        })) {
          save_oauth.expiration = new_expiration;
          save_oauth.token = new_token;
          save_oauth.refresh = new_refresh;
          await ctx.state.db.manager.save(OAuth, save_oauth);
        }
        oauth.expiration = new_expiration;
        oauth.token = new_token;
        oauth.refresh = new_refresh;
        console.log('Token refreshed OK');
      }

      for (const type of ['sleep', 'activity', 'readiness']) {
        let url = `${OURA_API_URL}/${type}?access_token=${oauth.token}`;
        let latest = since;

        const cached: Oura = await ctx.state.db.connection
        .getRepository(Oura)
        .createQueryBuilder('oura')
        .leftJoinAndSelect('oura.key', 'key')
        .leftJoinAndSelect('oura.user', 'user')
        .where('type = :type', {type: type})
        .andWhere('date >= :date', {date: since})
        .andWhere('key.key_id = :key', {key: key.key_id})
        .andWhere('user.user_id = :user', {user: user.user_id})
        .orderBy('date', 'DESC')
        .addOrderBy('seq', 'DESC')
        .limit(1)
        .getOne();
        if (cached && cached.date > latest) {
          latest = cached.date;
        }
        if (latest >= since) {
          url += '&start=' + latest;

          let response = null;
          try {
            response = await HttpClient.get(url);
          } catch (err) {
            ctx.response.status = 500;
            ctx.response.message = `Oura synchronization failed`;
            console.log(ctx.response.message);
            return;
          }
          const data: [] = response.data[type];
          // console.log('----');
          // console.log(JSON.stringify(data));
          // console.log('----');
          if (Array.isArray(data)) {
            const values: Oura[] = [];
            data.forEach((row) => {
              const date: string = row['summary_date'];
              if (!latest || date > latest) {
                const seq: number = row['period_id'] || 0;
                const value: Oura = new Oura();
                value.user = user;
                value.key = key;
                value.type = type;
                value.date = date;
                value.seq = seq;
                value.value = JSON.stringify(row);
                values.push(value);
              }
            });
            try {
              await ctx.state.db.manager.save(Oura, values);
            } catch (err) {
              console.log('Failed to save oura data');
              console.log(err);
            }
          } else {
            ctx.response.status = 500;
            ctx.response.message = `Expected an array from oura endpoint ${type}!`;
            console.log(ctx.response.message);
            return;
          }
        }
      };

      const result = {};
      const rows: Oura[] = await ctx.state.db.connection
      .getRepository(Oura)
      .createQueryBuilder('oura')
      .leftJoinAndSelect('oura.key', 'key')
      .leftJoinAndSelect('oura.user', 'user')
      .where('date >= :date', {date: since})
      .andWhere('key.key_id = :key', {key: key.key_id})
      .andWhere('user.user_id = :user', {user: user.user_id})
      .orderBy('date', 'DESC')
      .addOrderBy('seq', 'DESC')
      .getMany();
      for (const row of rows) {
        const date = row['date'];
        const type = row['type'];
        if (typeof result[date] === 'undefined') {
          result[date] = {};
        }
        if (typeof result[date][type] === 'undefined') {
          result[date][type] = [];
        }
        result[date][type].push({
          seq: row['seq'],
          value: row['value']
        })
      }
      return result;
    }
  }

};

export async function get_providers(ctx: Koa.ParameterizedContext) {
  const session_id: string = ctx.params.session_id;
  const sess: Session = await session.check_session(ctx, session_id) || null;
  if (sess === null) {
    return;
  }
  const user: User = await ctx.state.db.manager.findOne(User, {
    where: {user_id: sess.user.user_id},
    relations: ['oauths']
  });

  const providers: string[] = (user.oauths || []).map((oauth) => oauth.provider);
  ctx.response.body = JSON.stringify({
    expiration: Constants.SESSION_EXPIRATION,
    providers: providers
  });
}

export async function login_send(ctx: Koa.ParameterizedContext) {
  const oauth_provider: string = ctx.params.oauth_provider;
  const session_id: string = ctx.params.session_id;
  const sess: Session = await session.check_session(ctx, session_id) || null;
  if (sess === null) {
    return;
  }
  const user: User = await ctx.state.db.manager.findOne(User, {
    where: {user_id: sess.user.user_id},
    relations: ['oauths']
  });

  const oauth_api = OAUTH_PROVIDERS[oauth_provider];
  if (oauth_api === undefined) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown oauth provider "${oauth_provider}"`;
    return;
  }

  const oauths: OAuth[] = (user.oauths || []).filter((oauth) => oauth.provider === oauth_provider);
  let oauth: OAuth | null = oauths.length && oauths[0] || null;

  if (oauth && parseInt(oauth.expiration) > Date.now()) {
    ctx.body = 'Already have an access token, which is still valid';
    return;
  }

  const oauth_token = session.random_string(Constants.NONCE_LENGTH);
  oauth = new OAuth();
  oauth.provider = oauth_provider;
  oauth.scope = 'login';
  oauth.token = oauth_token;
  oauth.refresh = '';
  oauth.expiration = (Date.now() + 3 * 60_000).toString();
  await ctx.state.db.manager.save(OAuth, oauth);

  await oauth_api.authorize(ctx, oauth.oauth_id + ':' + oauth_token + ':' + user.user_id);
}

export async function login_return(ctx: Koa.ParameterizedContext) {
  const oauth_provider: string = ctx.params.oauth_provider;
  const oauth_api = OAUTH_PROVIDERS[oauth_provider];
  if (oauth_api === undefined) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown oauth provider "${oauth_provider}"`;
    return;
  }

  const oauth_state: string = ctx.query.state.split(':');
  //console.log(oauth_state);
  const oauth_id = parseInt(oauth_state[0]);
  const oauth_token = oauth_state[1];
  const user_id = parseInt(oauth_state[2]);

  const oauth: OAuth = await ctx.state.db.manager.findOne(OAuth, oauth_id);

  if (!oauth || oauth.scope !== 'login' || oauth.token !== oauth_token) {
    ctx.response.status = 400;
    ctx.response.message = `Received invalid oauth state from ${oauth_provider}`;
    return;
  }

  const oauth_code: string = ctx.query.code;
  if (oauth_code === undefined) {
    const err = ctx.query.error || 'access_denied';
    ctx.response.status = 400;
    ctx.response.message = `Received an error from ${oauth_provider}: ${err}`;
    return;
  }

  const data = await oauth_api.token(ctx, oauth_code);

  oauth.scope = ctx.query.scope; // data.scope;
  oauth.token = data.token;
  oauth.refresh = data.refresh;
  oauth.expiration = data.expire.toString();

  await ctx.state.db.manager.save(oauth);
  const user: User = await ctx.state.db.manager.findOne(User, {
    where: {user_id: user_id},
    relations: ['oauths']
  });
  user.oauths.push(oauth);
  await ctx.state.db.manager.save(user);

  ctx.body = `RPARS is now linked with your ${oauth_provider} account!`;
}

export async function fetch_data(ctx: Koa.ParameterizedContext) {
  const oauth_provider: string = ctx.params.oauth_provider;
  const sess: Session = await session.check_session(ctx) || null;
  if (sess === null) {
    return;
  }

  // TODO
  //const key_id: number = parseInt(ctx.request.body.key_id) || ctx.state.sb.noop_key.key_id;
  const key_id = ctx.state.db.noop_key.key_id;
  const since: string = ctx.request.body.since || '2020-05-01';

  const oauth_api = OAUTH_PROVIDERS[oauth_provider];
  if (oauth_api === undefined) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown oauth provider "${oauth_provider}"`;
    return;
  }

  const user: User = await ctx.state.db.manager.findOne(User, {
    where: {user_id: sess.user.user_id},
    relations: ['oauths']
  });

  const oauths: OAuth[] = (user.oauths || []).filter((oauth) => oauth.provider === oauth_provider);
  const oauth: OAuth | null = oauths.length === 1 && oauths[0] || null;
  if (oauth === null) {
    if (oauths.length === 0) {
      console.debug(`Did not find any ${oauth_provider} tokens for current user`);
    } else if (oauths.length > 1) {
      console.debug(`Found too many ${oauth_provider} tokens for current user`);
    }
    ctx.response.status = 403;
    ctx.response.message = `No token for ${oauth_provider}`;
    return;
  }

  let key: Key = null;
  if (key_id > 1) {
    for (const k of await user.keys) {
      if (k.key_id === key_id) {
        key = k;
        break;
      }
    }
    if (key === null) {
      ctx.response.status = 400;
      ctx.response.message = `Unknown key "${key_id}"`;
      return;
    }
  } else {
    key = ctx.state.db.noop_key;
  }

  const values: object = await oauth_api.synchronize(ctx, user, key, oauth, since);

  ctx.body = JSON.stringify({
    expiration: Constants.SESSION_EXPIRATION,
    key_id: key_id,
    values: values
  });
}