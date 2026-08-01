# eSSL biometric ADMS server — container image for cloud hosting
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better build caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the server
COPY . .

# The host platform sets PORT; server reads process.env.PORT (defaults 8080)
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
