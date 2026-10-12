import type { FrameClient } from '@curator/frame';
import type { Identifier } from 'injectkit';

/** DI token for the one {@link FrameClient} the process talks to the TV through. */
export const FrameClientToken: Identifier<FrameClient> = Symbol('FrameClient');
