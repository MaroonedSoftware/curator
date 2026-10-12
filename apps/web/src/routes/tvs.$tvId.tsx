import { createFileRoute } from '@tanstack/react-router';
import { TvLayout } from '../components/tvs/tv.layout';

export const Route = createFileRoute('/tvs/$tvId')({ component: TvRoute });

function TvRoute() {
    const { tvId } = Route.useParams();
    // Keyed by TV, so switching TVs starts each page afresh rather than carrying one TV's state to another.
    return <TvLayout key={tvId} tvId={tvId} />;
}
