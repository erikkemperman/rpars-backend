import * as Koa from 'koa';

import * as session from './session';
import * as util from './util';
import { User, Group, Project, Session } from './entity';
import { In, MoreThan, Not } from 'typeorm';


// Get group and project for current user
export async function member_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_session(ctx) || null;
  if (sess === null) {
    return;
  }
  const group: Group | null = sess.user.group || null;
  const project: Project | null = group !== null && group.project || null;
  ctx.response.body = JSON.stringify({
    project_id: project && project.project_id || null,
    project_name: project && project.project_name || null,
    group_id: group && group.group_id || null,
    group_name: group && group.group_name || null
  });
}

// Get all projects (admin only)
export async function member_project_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }

  const projects: Project[] = await ctx.state.db.manager.find(Project);
  ctx.response.body = JSON.stringify(projects.map((project) => { return {
    project_id: project.project_id,
    project_name: project.project_name
  }}));
}

// Get all groups in given project (admin only)
export async function member_group_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'project_id': 'number'
  })) {
    return;
  }

  const project_id: number = ctx.request.body.project_id;
  console.log('project id', project_id);
  const project: Project | null = await ctx.state.db.manager.findOne(Project, {
    where: { project_id: project_id },
    relations: ['groups']
  }) || null;
  const groups: Group[] = project && await project.groups || [];
  ctx.response.body = JSON.stringify(groups.map((group) => { return {
    group_id: group.group_id,
    group_name: group.group_name
  }}));
}

// Get all users in given group (admin only)
export async function member_user_get(ctx: Koa.ParameterizedContext) {
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
  const group: Group | null = await ctx.state.db.manager.findOne(Group, {
    where: { group_id: group_id},
    relations: ['users']
  }) || null;
  const users: User[] = group && await group.users || [];
  ctx.response.body = JSON.stringify(users.map((user) => { return {
    user_id: user.user_id,
    user_email: user.email
  }}));
}

// Get all users not currently in any (admin only)
export async function member_user_unassigned_get(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }

  const users: User[] = await ctx.state.db.manager.find(User, {
    where: { group: null, user_id: MoreThan(1) }
  });
  ctx.response.body = JSON.stringify(users.map((user) => { return {
    user_id: user.user_id,
    user_email: user.email
  }}));
}

// Add an unassigned user to group (admin only)
export async function member_add_users(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'group_id': 'number',
    'user_ids': 'number[]'
  })) {
    return;
  }

  const group_id = ctx.request.body.group_id;
  const user_ids = ctx.request.body.user_ids;
  const group: Group | null = await ctx.state.db.manager.findOne(Group, {
    where: { group_id: group_id},
    relations: [ 'users' ]
  }) || null;
  if (group === null) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown group #${group_id}`;
    return;
  }
  const users: User[] = await ctx.state.db.manager.find(User, {
    where: { user_id: In(user_ids), group: null},
    relations: [ 'group' ]
  }) || null;
  if (users.length === 0) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown users #${user_ids} or user(s) already assigned`;
    return;
  }
  if (users.length !== user_ids.length) {
    const missing_ids = [];
    for (const user_id of user_ids) {
      let found = false;
      for (const user of users) {
        if (user.user_id === user_id) {
          found = true;
          break;
        }
      }
      if (!found) {
        missing_ids.push(user_id);
      }
    }
    ctx.response.status = 400;
    ctx.response.message = `Unknown user #${missing_ids} or user(s) already assigned`;
    return;
  }
  for (const user of users) {
    user.group = group;
    await ctx.state.db.manager.save(user);
  }

  ctx.response.body = '{"status":"OK"}';
}

// Remove a user from its group (admin only)
export async function member_remove_user(ctx: Koa.ParameterizedContext) {
  const sess: Session = await session.check_admin_session(ctx) || null;
  if (sess === null) {
    return;
  }
  if (!util.check_parameters(ctx, {
    'user_id': 'number'
  })) {
    return;
  }

  const user_id = ctx.request.body.user_id;
  const user: User | null = await ctx.state.db.manager.findOne(User, {
    where: { user_id: user_id },
    relations: [ 'group' ]
  }) || null;
  if (user === null) {
    ctx.response.status = 400;
    ctx.response.message = `Unknown user #${user_id}`;
    return;
  }
  if (user.group === null) {
    ctx.response.status = 400;
    ctx.response.message = `User ${user_id} is not in a group`;
    return;
  }

  user.group = null;
  await ctx.state.db.manager.save(user);

  ctx.response.body = '{"status":"OK"}';
}