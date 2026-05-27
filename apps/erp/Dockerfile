FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/erp ./apps/erp
RUN npm ci
RUN npm -w packages/erp-db run generate
RUN npm -w packages/erp-db run build
RUN cp -r packages/erp-db/src/generated packages/erp-db/dist/generated
RUN npm -w apps/erp run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/erp/dist ./apps/erp/dist
COPY --from=build /app/apps/erp/package.json ./apps/erp/package.json
EXPOSE 4000
CMD ["node", "apps/erp/dist/server.js"]
