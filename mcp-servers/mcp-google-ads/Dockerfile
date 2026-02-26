FROM python:3.11-slim

WORKDIR /app

# Copy the requirements and local project
COPY . .

# Install dependencies and the package itself
RUN pip install --no-cache-dir -e .

# Expose SSE port
EXPOSE 8081

CMD ["python", "ads_mcp/server.py", "--sse"]
