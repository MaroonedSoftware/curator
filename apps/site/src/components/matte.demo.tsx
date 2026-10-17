import { useState } from 'react';
import styles from './matte.demo.module.css';

/**
 * A few of the TV's mattes, by the ids it uses (`apps/web/src/api/mattes.ts`). The widths and colours
 * are drawn by eye, not measured off a TV: this shows what a matte is, not what one looks like exactly.
 */
const STYLES = [
    { id: 'none', label: 'None', inset: '0%' },
    { id: 'modernthin', label: 'Modern thin', inset: '6%' },
    { id: 'modern', label: 'Modern', inset: '11%' },
    { id: 'modernwide', label: 'Modern wide', inset: '17%' },
    { id: 'shadowbox', label: 'Shadowbox', inset: '11%' },
] as const;

const COLOURS = [
    { id: 'polar', swatch: '#f3f2ee' },
    { id: 'warm', swatch: '#e8dcc6' },
    { id: 'sage', swatch: '#a9b49c' },
    { id: 'navy', swatch: '#2b3550' },
    { id: 'black', swatch: '#1c1c1c' },
] as const;

type StyleId = (typeof STYLES)[number]['id'];
type ColourId = (typeof COLOURS)[number]['id'];

/** The front page's picture: a Frame showing a piece, and the matte it wears, chosen live. */
export default function MatteDemo() {
    const [styleId, setStyleId] = useState<StyleId>('shadowbox');
    const [colourId, setColourId] = useState<ColourId>('polar');
    const style = STYLES.find(entry => entry.id === styleId) ?? STYLES[0];
    const colour = COLOURS.find(entry => entry.id === colourId) ?? COLOURS[0];
    const matteId = style.id === 'none' ? 'none' : `${style.id}_${colour.id}`;

    return (
        <figure className={styles.demo}>
            <div className={styles.tv}>
                <div className={styles.matte} style={{ background: colour.swatch, padding: style.inset }}>
                    <svg
                        className={`${styles.art} ${style.id === 'shadowbox' ? styles.shadowbox : ''}`}
                        viewBox="0 0 160 90"
                        preserveAspectRatio="xMidYMid slice"
                        role="img"
                        aria-label="A landscape: sage hills under a gold sun"
                    >
                        <rect width="160" height="90" fill="#f4efe6" />
                        <circle cx="112" cy="30" r="10" fill="#d9a441" />
                        <path d="M0 90 L0 62 Q30 40 58 58 T110 54 T160 50 L160 90 Z" fill="#a9b49c" />
                        <path d="M0 90 L0 74 Q40 58 82 72 T160 68 L160 90 Z" fill="#7a8f6b" />
                    </svg>
                </div>
            </div>
            <div className={styles.controls}>
                <div className={styles.group} role="radiogroup" aria-label="Matte style">
                    {STYLES.map(entry => (
                        <button
                            key={entry.id}
                            type="button"
                            role="radio"
                            aria-checked={entry.id === styleId}
                            className={styles.chip}
                            onClick={() => setStyleId(entry.id)}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
                <div className={styles.group} role="radiogroup" aria-label="Matte colour">
                    {COLOURS.map(entry => (
                        <button
                            key={entry.id}
                            type="button"
                            role="radio"
                            aria-checked={entry.id === colourId}
                            aria-label={entry.id}
                            title={entry.id}
                            disabled={style.id === 'none'}
                            className={styles.swatch}
                            style={{ background: entry.swatch }}
                            onClick={() => setColourId(entry.id)}
                        />
                    ))}
                </div>
            </div>
            <figcaption className={styles.caption}>
                <code>{matteId}</code> is what curator asks the TV for.
            </figcaption>
        </figure>
    );
}
