# Universal image — works on Render, Railway, Fly.io, Google Cloud Run,
# AWS App Runner, any VPS, or `docker run` locally.
FROM node:20-alpine

WORKDIR /app

# No dependencies to install, so we just copy the source.
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY api ./api

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# Runs as the non-root "node" user that ships with the image.
USER node

CMD ["node", "server.js"]
