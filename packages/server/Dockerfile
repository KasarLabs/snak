FROM node:24-alpine

RUN npm install -g pnpm

WORKDIR /snak

COPY . .
RUN pnpm install

EXPOSE 3002

CMD ["pnpm", "-w", "run", "server:prod"]