FROM node:23-alpine

WORKDIR /app

COPY web/package*.json ./

RUN npm install

COPY web/ .

VOLUME /app/db

EXPOSE 8097

CMD [ "npm", "run", "start" ]