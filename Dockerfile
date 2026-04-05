FROM node:18-alpine
WORKDIR /server
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm","start"]
