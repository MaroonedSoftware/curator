import { BinaryParser, defaultParserMappings, type ServerKitParserMapping } from '@maroonedsoftware/fastify';

/** ServerKit's parsers, plus raw image bodies for artwork uploads. */
export const parserMappings: Record<string, ServerKitParserMapping> = {
    ...defaultParserMappings,
    'image/jpeg': { parser: BinaryParser },
    'image/png': { parser: BinaryParser },
};
