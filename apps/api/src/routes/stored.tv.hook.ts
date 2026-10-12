import type { FastifyRequest } from 'fastify';
import { TvRepository } from '../modules/tvs/tv.repository.js';

/**
 * A `preHandler` that answers 404 for a `:tvId` that isn't stored, before a route touches anything
 * that belongs to it. Params are parsed by then, so a malformed id has already been refused with a 400.
 */
export const storedTvOnly = async (request: FastifyRequest): Promise<void> => {
    await request.container.get(TvRepository).get((request.params as { tvId: string }).tvId);
};
