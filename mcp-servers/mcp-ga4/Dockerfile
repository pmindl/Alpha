FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Build TS code
RUN npm run build

# Expose port
EXPOSE 8080

CMD ["npm", "start"]
