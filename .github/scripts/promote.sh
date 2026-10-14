#!/usr/bin/env bash
# Move `latest` onto this commit's image, after its tests have passed.
#
#     IMAGE=maroonedsoftware/curator promote.sh
#
# The image was pushed as IMAGE:<sha> by images.yml. The move is a registry-side retag
# (`imagetools create`), so nothing is pulled, rebuilt or pushed.
#
# Reads IMAGE, GITHUB_REF, GITHUB_SHA, GITHUB_REPOSITORY and RUNNER_TEMP from the runner, and
# GH_TOKEN for the compare API.

set -euo pipefail

: "${IMAGE:?IMAGE is the repository to retag in}"

# Never BACKWARDS. A run can get here for a commit older than the one the tag already names, when its
# push arrived late and a newer commit's run promoted first; moving the tag then would roll back
# everyone following it. So a tag moves only if this commit is not behind the one it names, which is
# read from the image's own revision label and compared through the API.
#
# Not behind, rather than "is main's head": a manual run rebuilding the same commit (for a base
# image's security fix, say) is exactly the run meant to move it. A tag naming a commit this one does
# not have in its history means main was rewritten, and main wins. A tag with no label, or none at
# all, has nothing to protect.
move() {
    local tag="$1" source="$2" config named status=""
    if config="$(docker buildx imagetools inspect "${IMAGE}:${tag}" --format '{{json .Image}}')"; then
        # One config for a single-platform image, a map of them by platform otherwise.
        named="$(printf '%s' "$config" | jq -r 'if has("config") then . else first(.[]) end | .config.Labels["org.opencontainers.image.revision"] // ""')"
    else
        echo "::warning::Could not read ${IMAGE}:${tag}, so there is nothing to compare against and it moves."
        named=""
    fi

    if [ -n "$named" ]; then
        if ! status="$(gh api "repos/${GITHUB_REPOSITORY}/compare/${named}...${GITHUB_SHA}" --jq .status 2> "${RUNNER_TEMP}/compare.err")"; then
            if ! grep -q 'HTTP 404' "${RUNNER_TEMP}/compare.err"; then
                cat "${RUNNER_TEMP}/compare.err" >&2
                return 1
            fi
            status=unknown
        fi
    fi

    if [ "$status" = behind ]; then
        echo "::notice::${IMAGE}:${tag} names ${named}, which is newer than ${GITHUB_SHA}, so it stays. This run is late, and a newer run owns the tag."
        return 0
    fi
    echo "Moving ${IMAGE}:${tag} from ${named:-nothing} (${status:-no revision}) onto ${source}."
    docker buildx imagetools create --tag "${IMAGE}:${tag}" "${IMAGE}:${source}"
}

# From main only. A manual run pointed at a branch would move `latest` onto a commit main never had.
# Its sha tag is published anyway.
if [ "${GITHUB_REF}" = refs/heads/main ]; then
    move latest "${GITHUB_SHA}"
else
    echo "::notice::Not main, so latest stays where it is."
fi
