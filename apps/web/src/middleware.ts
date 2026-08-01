import { defineMiddleware } from 'astro:middleware';
import { readSession } from './lib/session.ts';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.userId = readSession(context.cookies);
  return next();
});
