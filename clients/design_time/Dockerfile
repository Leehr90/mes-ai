FROM node:20-alpine

WORKDIR /app

COPY clients/design_time/package*.json ./

RUN npm ci

COPY clients/design_time ./
COPY clients/mes.config.json ../mes.config.json

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]