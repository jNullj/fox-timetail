FROM node:25.6.0-alpine

WORKDIR /app

COPY web/package*.json ./

ENV NODE_ENV=production
RUN npm ci --omit=dev

COPY web/ .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN mkdir -p /app/db && chown appuser:appgroup /app/db
VOLUME /app/db

EXPOSE 8097

USER appuser

CMD [ "npm", "run", "start" ]