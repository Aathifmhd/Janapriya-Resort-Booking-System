# Full-stack image for hosts other than Vercel: the backend API serves the built frontend from one process.
# Needs DATABASE_URL and JWT_SECRET.
FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm --prefix backend ci --omit=dev && npm --prefix frontend ci
COPY backend ./backend
COPY frontend ./frontend
RUN npm --prefix frontend run build
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "backend/src/index.js"]
