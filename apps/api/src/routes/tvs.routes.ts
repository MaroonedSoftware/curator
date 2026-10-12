import { httpError } from '@maroonedsoftware/errors';
import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DiscoveryService } from '../modules/discovery/discovery.service.js';
import type { TvRow } from '../modules/tvs/tv.repository.js';
import { TvService } from '../modules/tvs/tv.service.js';
import { frameRoutes } from './frame.routes.js';

/** A stored TV, as the API shows it. The pairing token never leaves the server. */
export const Tv = z.object({
    id: z.uuid(),
    name: z.string(),
    host: z.string(),
    port: z.number().int(),
    model: z.string().optional(),
    /** Whether the TV has issued a pairing token. False means it must be paired again. */
    paired: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Tv = z.infer<typeof Tv>;

export const toTv = (row: TvRow): Tv => ({
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    model: row.model ?? undefined,
    paired: row.token !== undefined && row.token !== null,
    createdAt: row.createdAt.toISO() ?? '',
    updatedAt: row.updatedAt.toISO() ?? '',
});

export const TvIdParams = z.object({ tvId: z.uuid() });

/** A TV's name: trimmed, not blank, short enough to fit a menu. */
const TvName = z.string().trim().min(1).max(60);

/** Where to find a TV: an IP address or a hostname such as `frame.local`, never a URL. */
const Host = z.union([z.ipv4(), z.ipv6(), z.hostname()], { error: 'host must be an IP address or a hostname' });

/**
 * The `:tvId` a request names, checked before anything reaches Postgres: a malformed id is a 400,
 * not a failed uuid cast.
 */
const tvIdOf = (request: FastifyRequest): string => {
    const parsed = TvIdParams.safeParse(request.params);
    if (!parsed.success) {
        throw httpError(400).withDetails({ reason: 'tvId must be a UUID' });
    }
    return parsed.data.tvId;
};

/** The TVs curator manages, and each one's own endpoints under `/tvs/:tvId`. */
export const TvsRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/tvs', { schema: { response: { 200: z.object({ items: z.array(Tv) }) } } }, async request => ({
        items: (await request.container.get(TvService).list()).map(toTv),
    }));

    // Static, so it wins over /tvs/:tvId.
    app.get(
        '/tvs/discover',
        {
            schema: {
                response: {
                    200: z.object({
                        items: z.array(
                            z.object({
                                host: z.string(),
                                port: z.number().int(),
                                name: z.string().optional(),
                                model: z.string().optional(),
                                tvId: z.uuid().optional(),
                            }),
                        ),
                    }),
                },
            },
        },
        async request => ({ items: await request.container.get(DiscoveryService).discover() }),
    );

    app.post(
        '/tvs',
        {
            config: { body: ['application/json'] },
            schema: {
                body: z.object({ host: Host, port: z.number().int().min(1).max(65535).default(8002), name: TvName.optional() }),
                response: { 201: Tv },
            },
        },
        async (request, reply) => reply.status(201).send(toTv(await request.container.get(TvService).connect(request.body))),
    );

    app.get('/tvs/:tvId', { schema: { params: TvIdParams, response: { 200: Tv } } }, async request =>
        toTv(await request.container.get(TvService).get(request.params.tvId)),
    );

    app.patch(
        '/tvs/:tvId',
        { config: { body: ['application/json'] }, schema: { params: TvIdParams, body: z.object({ name: TvName }), response: { 200: Tv } } },
        async request => toTv(await request.container.get(TvService).rename(request.params.tvId, request.body.name)),
    );

    app.delete('/tvs/:tvId', { schema: { params: TvIdParams } }, async (request, reply) => {
        if (!(await request.container.get(TvService).remove(request.params.tvId))) {
            throw httpError(404).withDetails({ reason: `no TV with id ${request.params.tvId}` });
        }
        return reply.status(204).send();
    });

    await app.register(
        frameRoutes(request => request.container.get(TvService).frameFor(tvIdOf(request))),
        { prefix: '/tvs/:tvId' },
    );
};
