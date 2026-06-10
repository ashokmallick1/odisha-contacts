# Use Node.js 22 to get native SQLite support
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application files
# Note: This will copy contacts.db and analytics_cache.json into the image
COPY . .

# Expose the port the app runs on
EXPOSE 3006

# Start the server
ENV PORT=3006
CMD ["node", "server.js"]
