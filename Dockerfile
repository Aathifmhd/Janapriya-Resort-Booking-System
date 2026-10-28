# Full-stack image: Express API + built website served from one process.
# Mount a persistent volume at /app/server/data so the SQLite database survives restarts.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci --ignore-scripts && npm --prefix server ci && npm --prefix client ci
COPY . .
RUN npm --prefix client run build
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
VOLUME ["/app/server/data"]
CMD ["node", "server/src/index.js"]
