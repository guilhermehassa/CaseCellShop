FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/store-web ./apps/store-web
RUN npm ci
EXPOSE 5173
CMD ["npm", "--workspace=store-web", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
