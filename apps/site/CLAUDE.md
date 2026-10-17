# The website

`apps/site` is the public site at `https://curator.maroonedsoftware.com`: a Docusaurus build whose
front page is a React page (`src/pages/index.tsx`) and whose docs live under `/docs`. It is not part
of the image. Its approach is rhapsode's and deadair's `apps/site`, so somebody who knows one knows
the others; its content and its look are its own.

`pnpm --filter @curator/site start` serves it on :14104 and `serve` serves the build on :14105;
`build` writes `dist/`. It has no `dev` script on purpose, so `pnpm dev` does not start a docs server
beside the API and the web app.

**Every dependency is a devDependency.** Nothing here runs in the image. `.dockerignore` keeps
everything but `package.json` out of the build context, so editing a page does not invalidate the
source layer; the manifest stays because the frozen lockfile names the site as a workspace member.

**No `"type": "module"`.** Docusaurus generates `.docusaurus/*.js` modules that call
`require.resolveWeak`, which the bundler only translates when it parses those files as CommonJS. Mark
the package as ESM and the build fails at static generation. The ESLint config is `.mjs` for this
reason.

**The `browserslist` block is load-bearing.** `future.v4` puts Infima and the theme in CSS cascade
layers. Without it, `postcss-preset-env` polyfills the layers into specificity hacks that outrank
every override in `src/css/custom.css`, and the site comes out in Infima's default blue.

**The colours are the web app's, copied.** `src/css/custom.css` restates Mantine's teal (the app's
`primaryColor`) and `apps/web/public/frame.svg`'s ink, paper, sage and gold. The favicon comes from
`apps/web/public` through `staticDirectories`, so the mark has one drawing.

**The "Build on it" pages are copied in, never edited here.** `scripts/docs.sync.mjs` copies the root
README and the READMEs of `apps/api`, `apps/web` and `packages/frame` into `docs/develop/` on every
`start` and `build`. The copies are gitignored; edit the sources. A link in a source is rewritten to
the copied page when it names a copied file, and to the file on GitHub otherwise. A new source is
four edits: the list in the script, `sidebars.ts`, `.gitignore` here, and the `inputs` of
`@curator/site#build` in `turbo.json` (and the `paths` of `site.yml`).

**The hand-written pages restate the READMEs for people running curator.** `docs/quick-start.md`
repeats the root README's "Running in Docker", and `docs/using.md` and the front page describe what
the web app does. When either changes, change these with it.

**No em dashes in anything written here.** `tests/prose.test.ts` holds the site's own pages and
components to it, and leaves the copies to their sources.

**A push to `main` is the deploy.** `.github/workflows/site.yml` builds `dist/` and publishes it to
GitHub Pages whenever a push touches the site or a file it reads from outside the package. It needs
the repository's Pages source set to "GitHub Actions" once, and fails at `configure-pages` saying so
until it is. The custom domain is set in the Pages settings, not in a `CNAME` file, which a Pages site
deployed from Actions ignores; `url` in `docusaurus.config.ts` changes with it.
