FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=pwuser:pwuser *.mjs ./
USER pwuser
ENV NODE_ENV=production
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.mjs"]
