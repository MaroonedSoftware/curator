import { createFileRoute } from '@tanstack/react-router';
import { TvsPage } from '../components/tvs/tvs.page';

export const Route = createFileRoute('/tvs')({ component: TvsPage });
