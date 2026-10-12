import { createContext, useContext } from 'react';
import type { Tv } from '../api/api.client';

/** The TV the pages under /tvs/$tvId are about. Provided by that layout route. */
export const TvContext = createContext<Tv | undefined>(undefined);

export function useTv(): Tv {
    const tv = useContext(TvContext);
    if (!tv) {
        throw new Error('useTv() is only available under /tvs/$tvId');
    }
    return tv;
}
