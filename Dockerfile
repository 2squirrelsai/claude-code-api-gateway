FROM node:20-alpine

WORKDIR /app

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
