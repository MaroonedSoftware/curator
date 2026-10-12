import { createFileRoute } from '@tanstack/react-router';
import { StatusPage } from '../components/status/status.page';

export const Route = createFileRoute('/tvs/$tvId/status')({ component: StatusPage });
