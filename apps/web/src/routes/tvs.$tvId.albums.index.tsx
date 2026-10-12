import { createFileRoute } from '@tanstack/react-router';
import { AlbumsPage } from '../components/albums/albums.page';

export const Route = createFileRoute('/tvs/$tvId/albums/')({
    component: AlbumsPage,
});
