import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const repository = 'https://github.com/MaroonedSoftware/curator';
const image = 'https://hub.docker.com/r/maroonedsoftware/curator';

const config: Config = {
    title: 'curator',
    tagline: 'Your own art on a Samsung Frame TV.',
    favicon: 'frame.svg',

    // A custom domain on the repository's Pages site, set in its Pages settings rather than in a
    // `CNAME` file, which a site deployed from Actions ignores.
    url: 'https://curator.maroonedsoftware.com',
    baseUrl: '/',
    // GitHub Pages serves `quick-start.html` at `/docs/quick-start` without a redirect, and a
    // trailing slash would give every page two addresses.
    trailingSlash: false,

    future: { v4: true },

    onBrokenLinks: 'throw',
    markdown: {
        // `.md` is CommonMark and `.mdx` is MDX. The pages copied in from the rest of the repository
        // are plain Markdown written for GitHub, and parsing them as MDX would reject any `<` or `{`
        // in prose that GitHub renders happily.
        format: 'detect',
        hooks: { onBrokenMarkdownLinks: 'throw' },
    },

    // The favicon lives with the web app and is served from there rather than copied, so the mark
    // has one drawing. Everything in `apps/web/public` is therefore on the site too.
    staticDirectories: ['../web/public'],

    clientModules: ['./src/fonts.ts'],

    presets: [
        [
            'classic',
            {
                docs: { editUrl: `${repository}/blob/main/apps/site/`, sidebarPath: './sidebars.ts' },
                blog: false,
                theme: { customCss: './src/css/custom.css' },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        // The web app follows the operating system, and so does this.
        colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
        navbar: {
            title: 'curator',
            logo: { alt: '', src: 'frame.svg' },
            items: [
                { type: 'docSidebar', sidebarId: 'run', label: 'Run it', position: 'left' },
                { type: 'docSidebar', sidebarId: 'build', label: 'Build on it', position: 'left' },
                { href: repository, label: 'GitHub', position: 'right' },
            ],
        },
        footer: {
            links: [
                {
                    title: 'Run it',
                    items: [
                        { label: 'Quick start', to: '/docs/quick-start' },
                        { label: 'Using it', to: '/docs/using' },
                    ],
                },
                {
                    title: 'Build on it',
                    items: [
                        { label: 'Developing', to: '/docs/develop' },
                        { label: 'The API', to: '/docs/develop/api' },
                        { label: 'The Frame client', to: '/docs/develop/frame' },
                    ],
                },
                {
                    title: 'Project',
                    items: [
                        { label: 'Source', href: repository },
                        { label: 'Docker image', href: image },
                        { label: 'Issues', href: `${repository}/issues` },
                        { label: 'Changelog', href: `${repository}/blob/main/apps/api/CHANGELOG.md` },
                        { label: 'Marooned Software', href: 'https://maroonedsoftware.com' },
                    ],
                },
            ],
            copyright: 'curator is MIT licensed. It is not made or endorsed by Samsung.',
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.oneDark,
            additionalLanguages: ['bash', 'json', 'yaml'],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
