FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/store-api ./apps/store-api
RUN npm ci
RUN npm -w packages/store-db run generate
RUN npm -w packages/contracts run build --if-present
RUN npm -w packages/store-db run build
RUN cp -r packages/store-db/src/generated packages/store-db/dist/generated
RUN npm -w apps/store-api run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/store-api/dist ./apps/store-api/dist
COPY --from=build /app/apps/store-api/package.json ./apps/store-api/package.json
EXPOSE 3000
CMD ["node", "apps/store-api/dist/src/server.js"]
