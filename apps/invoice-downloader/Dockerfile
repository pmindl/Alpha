FROM node:18-alpine

WORKDIR /app

# Install dependencies based on package.json
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application (if necessary) or just expose the script
# Since this is a TS project using tsx, we can just run it directly.

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Define the command to run the MCP server
CMD ["npm", "run", "mcp"]
