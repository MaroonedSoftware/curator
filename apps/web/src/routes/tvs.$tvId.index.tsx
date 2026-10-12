import { createFileRoute } from '@tanstack/react-router';
import { NowShowingPage } from '../components/now/now.showing.page';

export const Route = createFileRoute('/tvs/$tvId/')({ component: NowShowingPage });
