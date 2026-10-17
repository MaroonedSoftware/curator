// The "Build on it" pages are already written, where the repository's readers find them: the root
// README and one beside each package. Copying them into `docs/` by hand would make the site a second
// place to keep true, and the one nobody remembers. So each `start` and `build` copies them in fresh,
// with the front matter the sidebar needs and an edit link back to the real file, and the copies are
// gitignored.
//
// A link in a source is written for the repository. Two kinds are rewritten, outside code fences:
//
// - A link to another file this script copies, relative or as a GitHub URL, becomes a link to that
//   page on the site.
// - Any other relative link becomes that file on GitHub, resolved against the source's own
//   directory, where it would otherwise break the build.
//
// A link to an anchor on the same page is left alone.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = 'https://github.com/MaroonedSoftware/curator';
export const blob = `${repository}/blob/main`;

/**
 * Each source file, the doc it becomes under `docs/`, and its label in the sidebar. A `title`
 * replaces the source's own H1, for a source whose heading names the repository rather than the
 * page. The order the sidebar shows them in is `sidebars.ts`'s, not this list's.
 *
 * @type {{ source: string, doc: string, label: string, title?: string }[]}
 */
export const pages = [
    { source: 'README.md', doc: 'develop/index.md', label: 'Developing', title: 'Developing curator' },
    { source: 'apps/api/README.md', doc: 'develop/api.md', label: 'The API' },
    { source: 'apps/web/README.md', doc: 'develop/web.md', label: 'The web app' },
    { source: 'packages/frame/README.md', doc: 'develop/frame.md', label: 'The Frame client' },
];

/** The marker every copy carries, which the prose test uses to leave copies to their sources. */
export const NOTICE = 'Edit that file, not this one.';

/**
 * A link target that is neither a scheme, an absolute path nor an anchor.
 *
 * @param {string} target
 */
const isRelative = target => !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target);

/** `[text](target)` and `![alt](target)`, with an optional title after the target. */
const LINK = /(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;

/** A fenced code block, whole, from its opening fence to its closing one. */
const FENCE = /(^```[^\n]*\n[\s\S]*?^```[^\n]*$)/m;

/**
 * Where a link to `target`, written in `source`, should point once `source` is the site's `doc`.
 *
 * @param {string} target the link as written
 * @param {string} source the repository path of the file it is written in
 * @param {string} doc the path under `docs/` that file becomes
 * @returns {string}
 */
export function rewriteTarget(target, source, doc) {
    const [path = '', anchor] = target.split('#');
    const hash = anchor === undefined ? '' : `#${anchor}`;

    let resolved;
    if (target.startsWith(`${blob}/`)) resolved = path.slice(blob.length + 1);
    else if (isRelative(target)) resolved = posix.normalize(posix.join(posix.dirname(source), path));
    else return target;

    const copied = pages.find(page => page.source === resolved);
    // Relative to the doc's own file, which is how Docusaurus resolves a link to a `.md`.
    if (copied) return `${posix.relative(posix.dirname(doc), copied.doc)}${hash}`;
    return isRelative(target) ? `${blob}/${resolved}${hash}` : target;
}

/**
 * Rewrites every link outside a fenced code block.
 *
 * @param {string} body
 * @param {string} source
 * @param {string} doc
 * @returns {string}
 */
export function rewriteLinks(body, source, doc) {
    // Splitting on fences with a capture keeps them, and every odd piece is the inside of one.
    return body
        .split(FENCE)
        .map((piece, index) =>
            index % 2 === 1 ? piece : piece.replace(LINK, (_match, open, target, close) => `${open}${rewriteTarget(target, source, doc)}${close}`),
        )
        .join('');
}

/**
 * The copy of `body` as the site's page: front matter, the H1, the notice, the rest.
 *
 * @param {string} body
 * @param {{ source: string, doc: string, label: string, title?: string }} page
 * @returns {string}
 */
export function render(body, page) {
    const rewritten = rewriteLinks(body, page.source, page.doc);
    const frontMatter = ['---', `sidebar_label: ${page.label}`, `custom_edit_url: ${blob}/${page.source}`, '---', ''].join('\n');
    const notice = `<!-- Copied from ${page.source} by apps/site/scripts/docs.sync.mjs. ${NOTICE} -->\n`;
    // After the heading rather than before it: Docusaurus takes a page's title from an H1 only when
    // it is the first thing on the page.
    const heading = /^# [^\n]*\n/.exec(rewritten)?.[0] ?? '';
    const title = page.title === undefined ? heading : `# ${page.title}\n`;
    return frontMatter + title + notice + rewritten.slice(heading.length);
}

/** Copies every page in. */
async function sync() {
    const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const root = resolve(site, '../..');
    for (const page of pages) {
        const target = resolve(site, 'docs', page.doc);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, render(await readFile(resolve(root, page.source), 'utf8'), page));
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await sync();
