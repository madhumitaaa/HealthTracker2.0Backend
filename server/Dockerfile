# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# No need to run tests here unless you want

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app .
EXPOSE 5000
CMD ["node", "server.js"]