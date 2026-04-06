FROM node:22-alpine

WORKDIR /app

COPY package.json tsconfig.json next.config.mjs next-env.d.ts ./
RUN npm install

COPY app ./app
COPY components ./components
COPY lib ./lib

RUN npm run build

CMD ["npm", "run", "start"]

