import { createFileRoute } from '@tanstack/react-router';
import { ALL, LibraryPage, type LibraryView } from '../components/library/library.page';

export interface LibrarySearch {
    category?: string;
    /** Absent means the grid. */
    view?: 'list';
    /** The piece open in the viewer. */
    piece?: string;
}

export const Route = createFileRoute('/tvs/$tvId/library')({
    validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
        category: typeof search.category === 'string' && search.category !== ALL ? search.category : undefined,
        view: search.view === 'list' ? 'list' : undefined,
        piece: typeof search.piece === 'string' && search.piece.length > 0 ? search.piece : undefined,
    }),
    component: Library,
});

function Library() {
    const { category, view, piece } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <LibraryPage
            category={category ?? ALL}
            onCategoryChange={next => void navigate({ search: previous => ({ ...previous, category: next === ALL ? undefined : next }) })}
            view={view ?? 'grid'}
            onViewChange={(next: LibraryView) => void navigate({ search: previous => ({ ...previous, view: next === 'list' ? 'list' : undefined }) })}
            piece={piece}
            // Opening pushes a history entry, so Back closes the viewer; stepping through pieces replaces it.
            onPieceChange={next =>
                void navigate({ search: previous => ({ ...previous, piece: next }), replace: piece !== undefined && next !== undefined })
            }
        />
    );
}
