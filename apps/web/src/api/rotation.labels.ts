/** The intervals offered for a rotation, in minutes. The API takes anything from 1 to 1440. */
export const INTERVALS = [5, 15, 30, 60, 120, 360, 720, 1440];

/** "5 minutes", "1 hour", "6 hours", "1 day". */
export const intervalLabel = (minutes: number): string => {
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    if (minutes % 1440 === 0) return plural(minutes / 1440, 'day');
    if (minutes % 60 === 0) return plural(minutes / 60, 'hour');
    return plural(minutes, 'minute');
};
