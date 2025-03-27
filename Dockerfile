FROM node:20.10-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

RUN npm install serve -g

# Bundle app source
COPY . .

# Build the TypeScript files
RUN npm run build-prd

# Expose port 8080
EXPOSE 8080

# Start the app
CMD [ "serve", "-s", "dist" ]