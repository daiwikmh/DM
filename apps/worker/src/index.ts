/**
 * Intake + resolution worker.
 *
 * Deliberately separate from the Astro app: Meta webhooks need a sub-second ACK
 * with their own retry semantics, and resolution is a multi-second vision call
 * plus an external API. Neither belongs in an SSR request handler.
 *
 * Env is loaded by the --env-file-if-exists flag in package.json, not here:
 * ESM hoists imports above statements, so @prava/db would read process.env
 * before any in-module loader could populate it.
 */
import { startIntakeServer } from './intake/server.ts';
import { startResolverLoop } from './resolver/loop.ts';
import { startCheckoutServer } from './checkout/server.ts';

startIntakeServer(Number(process.env.INTAKE_PORT ?? 8787));
startResolverLoop();
startCheckoutServer(Number(process.env.CHECKOUT_PORT ?? 8788));
