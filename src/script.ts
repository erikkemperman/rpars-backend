import * as Koa from 'koa';

import * as session from './session';
import * as util from './util';

import { readFileSync } from 'fs';

import { User, Group, Session, Script } from './entity';


// Get group and project for current user
export async function script_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_session(ctx) || null;
  if (sess === null) {
    return;
  }

  const member = await ctx.state.db.connection
        .getRepository(User)
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.group', 'group')
        .where('user.user_id = :user', {user: sess.user.user_id})
        .getOne();

  const group_id = member && member.group && member.group.group_id || -1;
  const group: Group | null = group_id < 0 ? null : await ctx.state.db.manager.findOne(Group, {
    where: { group_id: group_id },
    relations: [ 'script' ]
  }) || null;
  if (group === null) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown group #${group_id}`;
    return;
  }
  let script = group.script;
  if (group.script === null) {
    script = new Script();
    script.source = '// Edit source code here\n';
    script.locked = false;
    await ctx.state.db.manager.save(script);
    group.script = script;
    await ctx.state.db.manager.save(group);
  }

  const wrap = readFileSync('./dist/script_wrap.js', 'utf-8');
  const compiled = wrap.replace('//<--BODY-->//', script.source);

  ctx.response.body = JSON.stringify({
    script_id: script.script_id,
    locked: script.locked,
    source: compiled
  });
}

// Get all scripts in given group (admin only)
export async function script_group_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'group_id': 'number'
  })) {
    return;
  }

  const group_id: number = ctx.request.body.group_id;
  const group: Group | null = group_id < 0 ? null : await ctx.state.db.manager.findOne(Group, {
    where: { group_id: group_id },
    relations: [ 'script' ]
  }) || null;
  if (group === null) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown group #${group_id}`;
    return;
  }
  let script = group.script;
  if (group.script === null) {
    script = new Script();
    script.source = '// Edit source code here\n';
    script.locked = false;
    await ctx.state.db.manager.save(script);
    group.script = script;
    await ctx.state.db.manager.save(group);
  }

  ctx.response.body = JSON.stringify({
    script_id: script.script_id,
    locked: script.locked,
    source: script.source
  });
}

// Save a script (admin only)
export async function script_put(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'script_id': 'number',
    'source': 'string',
    'locked': 'boolean'
  })) {
    return;
  }

  const script_id: number = ctx.request.body.script_id;
  const source: string = ctx.request.body.source;
  const locked: boolean = ctx.request.body.locked;
  const script: Script | null = await ctx.state.db.manager.findOne(Script, script_id) || null;
  if (script === null) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown script #${script_id}`;
    return;
  }

  script.source = source;
  script.locked = locked;



  // TODO script.compiled = ...
  await ctx.state.db.manager.save(script);
  ctx.response.body = '{"status":"OK", "errors": []}';
}
