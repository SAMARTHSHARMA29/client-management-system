# Use Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment variable
ENV PORT=3000

# Start command
CMD ["npm", "start"]
