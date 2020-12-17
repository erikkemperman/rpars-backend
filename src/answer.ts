import * as Koa from 'koa';

import * as session from './session';
import * as util from './util';

import { Answer, User, Session } from './entity';
import { userInfo } from 'os';
import { createContext } from 'vm';

export async function answer_set(ctx: Koa.ParameterizedContext) {
  const now = Date.now();
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'date': 'string',
    'key': 'string',
    'title': 'string',
    'subtitle': 'string',
    'content': 'string',
    'time_delta': 'number',
    'expire_delta': 'number',
    'options': 'string',
    'answer': 'number'
  })) {
    return;
  }

  let answer: Answer = await ctx.state.db.manager.findOne(Answer, {
    where: {
      user: sess.user,
      date: ctx.request.body.date,
      key: ctx.request.body.key
    }
  }) || new Answer();

  answer.user = sess.user;
  answer.date = ctx.request.body.date;
  answer.key = ctx.request.body.key;
  answer.title = ctx.request.body.title;
  answer.subtitle = ctx.request.body.subtitle;
  answer.content = ctx.request.body.content;
  answer.time = (now - ctx.request.body.time_delta).toString();
  answer.expire = (now - ctx.request.body.expire_delta).toString();
  answer.options = ctx.request.body.options;
  answer.answer = ctx.request.body.answer;

  try {
    await ctx.state.db.manager.save(Answer, answer);
    ctx.response.body = "{\"status\": \"OK\"}";
  } catch (err) {
    console.error(`Failed to save answer {err}`);
    ctx.response.status = 500;
    ctx.response.message = `Failed to save answer {err}`;
  }

}