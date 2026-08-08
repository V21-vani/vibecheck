# Optional hardened sandbox runtime.
#
# By default the orchestrator isolates each scan with a throwaway temp
# directory + dedicated process tree (see packages/orchestrator/src/sandbox.ts).
# That's enough isolation for local/CI use. For untrusted, third-party repos
# in a hosted deployment, run the whole scan inside this container instead —
# it gets you a real filesystem/network boundary on top of the process isolation.
#
# Build:  docker build -t vibecheck-sandbox -f docker/sandbox.Dockerfile .
# Run:    docker run --rm -v $(pwd)/.vibecheck:/out vibecheck-sandbox \
#           npm run scan -- https://github.com/some-org/some-repo --out /out

FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json

RUN npm install --omit=dev --workspace=packages/orchestrator

COPY packages/orchestrator packages/orchestrator

RUN npm run build --workspace=packages/orchestrator

# No network egress beyond git clone + npm install for the target repo —
# run with --network=none once the target repo's deps are vendored/cached
# if you want a hard guarantee.
ENTRYPOINT ["node", "packages/orchestrator/dist/cli.js"]
