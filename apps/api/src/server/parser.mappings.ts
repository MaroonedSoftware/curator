import { BinaryParser, defaultParserMappings, type ServerKitParserMapping } from '@maroonedsoftware/fastify';
import { UPLOAD_IMAGE_TYPES } from '../modules/frame/image.converter.js';

/** ServerKit's parsers, plus raw image bodies for artwork uploads. */
export const parserMappings: Record<string, ServerKitParserMapping> = {
    ...defaultParserMappings,
    ...Object.fromEntries(UPLOAD_IMAGE_TYPES.map(mediaType => [mediaType, { parser: BinaryParser }])),
};
