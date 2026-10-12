import { createFileRoute } from '@tanstack/react-router';
import { AlbumPage } from '../components/albums/album.page';

export const Route = createFileRoute('/tvs/$tvId/albums/$albumId')({ component: Album });

function Album() {
    const { albumId } = Route.useParams();
    return <AlbumPage key={albumId} albumId={albumId} />;
}
