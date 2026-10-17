import { describe, expect, it } from 'vitest';
import { blob, NOTICE, render, rewriteLinks, rewriteTarget } from '../../scripts/docs.sync.mjs';

describe('rewriteTarget', () => {
    it('sends a relative link to a copied file to its page', () => {
        expect(rewriteTarget('../../packages/frame/README.md', 'apps/api/README.md', 'develop/api.md')).toBe('frame.md');
    });

    it('keeps the anchor', () => {
        expect(rewriteTarget('../api/README.md#routes', 'apps/web/README.md', 'develop/web.md')).toBe('api.md#routes');
    });

    it('sends a GitHub link to a copied file to its page', () => {
        expect(rewriteTarget(`${blob}/apps/web/README.md`, 'README.md', 'develop/index.md')).toBe('web.md');
    });

    it('sends a relative link to any other file to GitHub', () => {
        expect(rewriteTarget('unraid/curator.xml', 'README.md', 'develop/index.md')).toBe(`${blob}/unraid/curator.xml`);
    });

    it('leaves external links and anchors alone', () => {
        expect(rewriteTarget('https://example.com/a.md', 'README.md', 'develop/index.md')).toBe('https://example.com/a.md');
        expect(rewriteTarget('#ports', 'README.md', 'develop/index.md')).toBe('#ports');
    });
});

describe('rewriteLinks', () => {
    it('leaves links inside code fences alone', () => {
        const body = '[a](LICENSE)\n\n```\n[b](LICENSE)\n```\n';
        expect(rewriteLinks(body, 'README.md', 'develop/index.md')).toBe(`[a](${blob}/LICENSE)\n\n\`\`\`\n[b](LICENSE)\n\`\`\`\n`);
    });
});

describe('render', () => {
    const page = { source: 'packages/frame/README.md', doc: 'develop/frame.md', label: 'The Frame client' };

    it('puts the front matter first and the notice after the heading', () => {
        const out = render('# @curator/frame\n\nBody.\n', page);
        expect(out).toMatch(/^---\nsidebar_label: The Frame client\ncustom_edit_url: .*packages\/frame\/README\.md\n---\n# @curator\/frame\n<!-- /);
        expect(out).toContain(NOTICE);
        expect(out.endsWith('\nBody.\n')).toBe(true);
    });

    it('replaces the heading when the page has a title of its own', () => {
        const out = render('# curator\n\nBody.\n', { ...page, title: 'Developing curator' });
        expect(out).toContain('---\n# Developing curator\n<!-- ');
        expect(out).not.toContain('# curator\n');
    });
});
