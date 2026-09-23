FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.js backend.js journal-tools.js ./
COPY scripts ./scripts
USER node
ENV ADAPTER_BIND_HOST=0.0.0.0
ENV PORT=3334
EXPOSE 3334
CMD ["node", "server.js"]
