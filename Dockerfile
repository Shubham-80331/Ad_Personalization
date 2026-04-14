FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
