FROM node:20-alpine

# Install git for code-api functionality
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Initialize git repo for code versioning
RUN git config --global user.email "clawdistan@fly.dev" && \
    git config --global user.name "Clawdistan" && \
    git init && \
    git add -A && \
    git commit -m "Initial deployment" || true

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
