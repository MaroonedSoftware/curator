import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';
import MatteDemo from '../components/matte.demo';
import styles from './index.module.css';

const IMAGE = 'https://hub.docker.com/r/maroonedsoftware/curator';

// The quick start's compose file, cut to what a reader needs to see to believe it is one container.
const COMPOSE = `services:
    curator:
        image: maroonedsoftware/curator:latest
        ports: ['14100:14100']
        environment:
            DATABASE_HOST: db
            DATABASE_PASSWORD: change-me
        volumes: [curator-data:/data]
    db:
        image: postgres:17
        environment:
            POSTGRES_PASSWORD: change-me`;

// The API README's upload example.
const UPLOAD = `curl -X POST "localhost:14100/api/tvs/$TV_ID/art?matte=shadowbox_polar" \\
  -H 'content-type: image/jpeg' \\
  --data-binary @photo.jpg

{ "contentId": "MY-F0042" }`;

/** What the web app does, page by page. Each is in "Using it" at more length. */
const FEATURES = [
    {
        name: 'Find and pair',
        text: 'Search the network for Frames, or type an address, and accept the prompt on the TV once. Several TVs, one picker.',
    },
    {
        name: 'Upload',
        text: 'Drop a JPEG or PNG, or a WebP, AVIF, GIF or TIFF that curator converts. Pick its mattes and show it at once.',
    },
    {
        name: 'Library',
        text: 'Everything on the TV by category, as thumbnails or a list. Show a piece, change its matte, replace its image, or delete it.',
    },
    {
        name: 'Albums that rotate',
        text: 'Gather pieces into Halloween or Christmas, then have the TV cycle through one, in order or shuffled, as often as every minute.',
    },
    {
        name: 'Backups',
        text: 'A zip of every original, matte, album and rotation. Restore it onto the same TV or a new one, as often as you like.',
    },
    {
        name: 'Nothing in between',
        text: 'No phone app, no Samsung account and no cloud. curator talks to the TV on your network and keeps its data in your Postgres.',
    },
];

export default function Home() {
    return (
        <Layout description="Manage the art on your Samsung Frame TVs from a self-hosted web app: upload, mattes, albums that rotate, and backups.">
            <main className={styles.page}>
                <section className={styles.hero}>
                    <div className={styles.heroCopy}>
                        <h1 className={styles.headline}>Your own art on a Samsung Frame.</h1>
                        <p className={styles.lede}>
                            curator is a web app you run yourself for the art on your Frame TVs. Upload pictures, choose their mattes, gather them
                            into albums the TV rotates through, and back the lot up, all over the TV’s own local protocol.
                        </p>
                        <div className={styles.actions}>
                            <Link className={styles.primary} to="/docs/quick-start">
                                Quick start
                            </Link>
                            <Link className={styles.secondary} to="/docs/using">
                                See what it does
                            </Link>
                        </div>
                        <p className={styles.small}>
                            MIT licensed. One <a href={IMAGE}>Docker image</a> beside a Postgres, with an Unraid template. Not made or endorsed by
                            Samsung.
                        </p>
                    </div>
                    <MatteDemo />
                </section>

                <section className={styles.section}>
                    <h2>Everything the TV can do with art, from a browser</h2>
                    <dl className={styles.features}>
                        {FEATURES.map(feature => (
                            <div key={feature.name} className={styles.feature}>
                                <dt>{feature.name}</dt>
                                <dd>{feature.text}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className={styles.split}>
                    <div className={styles.prose}>
                        <h2>It talks to the TV, and checks what the TV did</h2>
                        <p>
                            A Frame answers art-mode requests on a WebSocket on your network. curator speaks that protocol from TypeScript, ported
                            from <a href="https://github.com/NickWaterton/samsung-tv-ws-api">samsung-tv-ws-api</a> and matched to it byte for byte.
                        </p>
                        <p>
                            <strong>The TV rarely says yes.</strong> Most writes go unanswered, so curator reads the TV’s state back after a change
                            instead of trusting the request. Uploads are the exception: they wait for the TV to announce the new piece.
                        </p>
                        <p>
                            <strong>One request at a time.</strong> The TV handles concurrent art requests badly, so each TV gets one connection that
                            queues them, and thumbnails are fetched in batches and cached.
                        </p>
                        <p>
                            <Link to="/docs/develop/frame">The Frame client</Link>
                        </p>
                    </div>
                    <CodeBlock language="bash" title="Upload, with a matte" className={styles.code}>
                        {UPLOAD}
                    </CodeBlock>
                </section>

                <section className={styles.split}>
                    <div className={styles.prose}>
                        <h2>Run it</h2>
                        <p>
                            The image, <a href={IMAGE}>maroonedsoftware/curator</a> on Docker Hub, holds the web app and the API, and applies its
                            database migrations every time it starts. Point it at a Postgres 17 and it creates its database on the first start.
                        </p>
                        <p>
                            Searching for TVs needs multicast on their network, so run it on host networking to use it, or add each TV by address. On
                            Unraid, the template does that for you.
                        </p>
                        <p>
                            The <Link to="/docs/quick-start">quick start</Link> has the whole compose file, and the Unraid steps.
                        </p>
                    </div>
                    <CodeBlock language="yaml" title="compose.yaml, abridged" className={styles.code}>
                        {COMPOSE}
                    </CodeBlock>
                </section>

                <section className={styles.section}>
                    <h2>Build on it</h2>
                    <ul className={styles.routes}>
                        <li>
                            <h3>
                                <Link to="/docs/develop/api">Call the API</Link>
                            </h3>
                            <p>Every route the web app uses, with what a TV’s failures come back as: asleep, silent, refused or rejected.</p>
                        </li>
                        <li>
                            <h3>
                                <Link to="/docs/develop/frame">Use the Frame client</Link>
                            </h3>
                            <p>The art-mode protocol as a TypeScript package, with a probe to run against a real TV and a fake TV for the tests.</p>
                        </li>
                        <li>
                            <h3>
                                <Link to="/docs/develop">Work on curator</Link>
                            </h3>
                            <p>A pnpm and turbo workspace: the API on ServerKit Fastify, the web app on React and Mantine, and Postgres in Docker.</p>
                        </li>
                    </ul>
                </section>
            </main>
        </Layout>
    );
}
