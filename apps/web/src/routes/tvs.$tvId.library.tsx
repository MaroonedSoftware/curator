import { createFileRoute } from '@tanstack/react-router';
import { ALL, LibraryPage, type LibraryView } from '../components/library/library.page';

export interface LibrarySearch {
    category?: string;
    /** Absent means the grid. */
    view?: 'list';
}

export const Route = createFileRoute('/tvs/$tvId/library')({
    validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
        category: typeof search.category === 'string' && search.category !== ALL ? search.category : undefined,
        view: search.view === 'list' ? 'list' : undefined,
    }),
    component: Library,
});

function Library() {
    const { category, view } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <LibraryPage
            category={category ?? ALL}
            onCategoryChange={next => void navigate({ search: previous => ({ ...previous, category: next === ALL ? undefined : next }) })}
            view={view ?? 'grid'}
            onViewChange={(next: LibraryView) => void navigate({ search: previous => ({ ...previous, view: next === 'list' ? 'list' : undefined }) })}
        />
    );
}
