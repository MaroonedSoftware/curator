import { createFileRoute } from '@tanstack/react-router';
import { UploadPage } from '../components/upload/upload.page';

export const Route = createFileRoute('/upload')({ component: UploadPage });
