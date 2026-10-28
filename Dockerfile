# Full-stack image: Express API + built website served from one process. Needs DATABASE_URL and JWT_SECRET.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --ignore-scripts && npm --prefix client ci
COPY . .
RUN npm --prefix client run build
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "server/src/index.js"]
