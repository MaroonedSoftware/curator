# Changesets

A changeset is a file here that says what a change does for whoever runs curator, and how far it
bumps the version. `pnpm changeset` writes one. Add one to any pull request a user would notice.

`@curator/api`, `@curator/web` and `@curator/frame` ship in one image and share one version, so
naming any one of them bumps all three: name the one you changed. The `@repo/*` configs are not
versioned.

How these become a release is in the root README, under "Releasing".
