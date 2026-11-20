FROM node:24-alpine

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install && npm install --prefix server && npm install --prefix client

# Copy source code
COPY shared ./shared
COPY server ./server
COPY client ./client

# Build both backend & production frontend bundle
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]
