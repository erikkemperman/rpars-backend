import * as http from 'http';
// import * as https from 'https';

import * as Koa from 'koa';
import * as cors from '@koa/cors';
import * as BodyParser from 'koa-bodyparser';
import * as logger from 'koa-logger';
import * as ratelimit from 'koa-ratelimit';
import * as Router from 'koa-router';

import { Constants } from './constants';
import { Database } from './database';

import * as cipher from './cipher';
import * as session from './session';
import * as oauth from './oauth';


Database.create().then((db: Database) => {
  const server = new Koa();
  server.use(cors({
    origin: (ctx) => ctx.get('Origin'),
    methods: 'OPTIONS,GET,POST',
    allowHeaders: 'content-type,retry-after,authorization',
    exposeHeaders: 'content-type,retry-after,authorization',
    credentials: true,
    keepHeadersOnError: true
  }));
  server.use(logger());

  // Override cookies to force secure (WAF misery)
  server.use(async (ctx: Koa.ParameterizedContext, next: Koa.Next) => {
    ctx.cookies.secure = true;
    await next();
  });

  server.use(BodyParser());

  // Overwrite remote ip address from x-forwarded-for header, if any.
  // This is needed when using proxies or load-balancers; otherwise we would
  // use the nearest proxy IP for rate-limiting instead of the actual client.
  server.use(async (ctx: Koa.ParameterizedContext, next: Koa.Next) => {
    const forwarded = ctx.request.get('x-forwarded-for');
    if (forwarded) {
      ctx.request.ip = forwarded.split(/\s*,\s*/)[0];
    }
    await next();
  });

  // Configure rate-limiting
  server.use(ratelimit({
    driver: 'memory',
    db: new Map(),
    max: Constants.RATELIMIT_MAX,
    duration: Constants.RATELIMIT_DURATION,
    errorMessage: 'Too many requests',
    id: (ctx: Koa.ParameterizedContext) => ctx.request.ip,
    headers: {
      remaining: 'Rate-Limit-Remaining',
      reset: 'Rate-Limit-Reset',
      total: 'Rate-Limit-Total'
    }
  }));

  // Attach/detach database
  server.use(async (ctx: Koa.ParameterizedContext, next: Koa.Next) => {
    ctx.state.db = await db.maintain();
    await next();
    delete ctx.state.db;
  });


  // -- Setup router --

  const router = new Router();

  // TODO remove
  router.get('status', '/api/status', async (ctx: Koa.ParameterizedContext) => {
    let body = `Hello ${ctx.request.ip}`;
    for (let [key, val] of Object.entries(ctx.request.headers)) {
      body += `\r\n${key} = ${val}`;
    }
    ctx.response.body = body;
  });

  router.post('session_login_init', '/api/session_login_init', session.session_login_init);
  router.post('session_login_fini', '/api/session_login_fini', session.session_login_fini);
  router.post('session_logout', '/api/session_logout', session.session_logout);

  router.post('key_get', '/api/key_get', cipher.key_get);
  router.post('key_set', '/api/key_set', cipher.key_set);

  router.post('oauth_providers', '/api/oauth_providers', oauth.get_providers);
  router.get('oauth_send', '/api/oauth_send/:oauth_provider/:session_id', oauth.login_send);
  router.get('oauth_return', '/api/oauth_return/:oauth_provider', oauth.login_return);
  router.post('oauth_data', '/api/oauth_data/:oauth_provider', oauth.fetch_data);

  server.use(router.routes());


  // -- Start listening for requests --

  http.createServer(server.callback()).listen(Constants.HTTP_PORT);
  console.log(`HTTP server running on port ${Constants.HTTP_PORT}`);
  // https.createServer({}, server.callback()).listen(Constants.HTTPS_PORT);
  // console.log(`HTTPS server running on port ${Constants.HTTPS_PORT}`);

}).catch(error => console.log(error));
