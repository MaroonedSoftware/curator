import { createFileRoute } from '@tanstack/react-router';
import { ALL, LibraryPage } from '../components/library/library.page';

export interface LibrarySearch {
    category?: string;
}

export const Route = createFileRoute('/tvs/$tvId/library')({
    validateSearch: (search: Record<string, unknown>): LibrarySearch => ({
        category: typeof search.category === 'string' && search.category !== ALL ? search.category : undefined,
    }),
    component: Library,
});

function Library() {
    const { category } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <LibraryPage category={category ?? ALL} onCategoryChange={next => void navigate({ search: { category: next === ALL ? undefined : next } })} />
    );
}
