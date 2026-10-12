import { Category } from './api.client';

const LABELS: Record<string, string> = {
    [Category.MyPhotos]: 'My Photos',
    [Category.Favourites]: 'Favourites',
    [Category.Store]: 'Art Store',
};

/** A person's name for a TV category id, or the id itself for one we don't know. */
export const categoryLabel = (categoryId: string | undefined): string => (categoryId ? (LABELS[categoryId] ?? categoryId) : 'Unknown');
