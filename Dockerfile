FROM node:24-alpine

WORKDIR /app

COPY web/package*.json ./

RUN npm install

COPY web/ .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN mkdir -p /app/db && chown appuser:appgroup /app/db
VOLUME /app/db

EXPOSE 8097

USER appuser

CMD [ "npm", "run", "start" ]