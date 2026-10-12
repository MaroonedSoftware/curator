/**
 * Matte ids are `${style}_${colour}`, or `none`. The lists are the TV's `get_matte_list` reply as
 * the reference library (samsungtvws) documents it, Samsung's spellings included. Not every matte
 * fits every aspect ratio; the TV rejects one that doesn't, and the API answers 422.
 */
export const MATTE_STYLES = ['modernthin', 'modern', 'modernwide', 'flexible', 'shadowbox', 'panoramic', 'triptych', 'mix', 'squares'] as const;

export const MATTE_COLOURS = [
    'black',
    'neutral',
    'antique',
    'warm',
    'polar',
    'sand',
    'seafoam',
    'sage',
    'burgandy',
    'navy',
    'apricot',
    'byzantine',
    'lavender',
    'redorange',
    'skyblue',
    'turqoise',
] as const;

export const NO_MATTE = 'none';

export interface MatteParts {
    style: string;
    colour?: string;
}

/** Splits a matte id into its style and colour. `none`, or anything unrecognised, is its own style. */
export function parseMatte(matte: string | undefined): MatteParts {
    if (!matte || matte === NO_MATTE) {
        return { style: NO_MATTE };
    }
    const separator = matte.lastIndexOf('_');
    if (separator <= 0) {
        return { style: matte };
    }
    return { style: matte.slice(0, separator), colour: matte.slice(separator + 1) };
}

export const formatMatte = ({ style, colour }: MatteParts): string => (style === NO_MATTE || !colour ? style : `${style}_${colour}`);

/** "shadowbox_polar" → "Shadowbox, polar". */
export const matteLabel = (matte: string | undefined): string => {
    const { style, colour } = parseMatte(matte);
    const name = style === NO_MATTE ? 'No matte' : style.charAt(0).toUpperCase() + style.slice(1);
    return colour ? `${name}, ${colour}` : name;
};
