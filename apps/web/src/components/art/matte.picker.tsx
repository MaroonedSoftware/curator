import { Group, Select } from '@mantine/core';
import { formatMatte, MATTE_COLOURS, MATTE_STYLES, NO_MATTE, parseMatte } from '../../api/mattes';

const STYLE_OPTIONS = [{ value: NO_MATTE, label: 'No matte' }, ...MATTE_STYLES.map(style => ({ value: style, label: style }))];

interface MattePickerProps {
    label: string;
    value: string;
    onChange: (matte: string) => void;
}

/** A matte as a style and a colour. Choosing a style keeps the colour, or picks the first one. */
export function MattePicker({ label, value, onChange }: MattePickerProps) {
    const { style, colour } = parseMatte(value);

    return (
        <Group grow align="flex-end">
            <Select
                label={label}
                data={STYLE_OPTIONS}
                value={style}
                allowDeselect={false}
                onChange={next => onChange(formatMatte({ style: next ?? NO_MATTE, colour: colour ?? MATTE_COLOURS[0] }))}
            />
            <Select
                label={`${label} colour`}
                data={[...MATTE_COLOURS]}
                value={style === NO_MATTE ? null : (colour ?? null)}
                disabled={style === NO_MATTE}
                placeholder="—"
                allowDeselect={false}
                onChange={next => onChange(formatMatte({ style, colour: next ?? undefined }))}
            />
        </Group>
    );
}
