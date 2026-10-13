import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { type Backup, BackupService } from '../modules/backup/backup.service.js';
import { TvIdParams } from './tvs.routes.js';

const download = (reply: FastifyReply, { fileName, stream }: Backup) =>
    reply
        .type('application/zip')
        .header('cache-control', 'no-store')
        .header('content-disposition', `attachment; filename="${fileName}"`)
        .send(stream);

/**
 * Backups as a zip download: `/backup` for every TV, `/tvs/:tvId/backup` for one. The zip streams
 * as it is written, so its size isn't known up front.
 */
export const BackupRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/backup', async (request, reply) => download(reply, await request.container.get(BackupService).all()));

    // An unknown TV answers 404 before the download starts.
    app.get('/tvs/:tvId/backup', { schema: { params: TvIdParams } }, async (request, reply) =>
        download(reply, await request.container.get(BackupService).one(request.params.tvId)),
    );
};
