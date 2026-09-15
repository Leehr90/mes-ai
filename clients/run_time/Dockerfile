FROM node:20-alpine

WORKDIR /app

COPY clients/run_time/package*.json ./

RUN npm ci

COPY clients/run_time ./
COPY clients/mes.config.json ../mes.config.json

EXPOSE 5176

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]