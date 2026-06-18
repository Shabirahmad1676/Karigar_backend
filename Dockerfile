# Step 1: Use an official lightweight Node.js base image
FROM node:20-alpine

# Step 2: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Step 4: Install your application dependencies
RUN npm install

# Step 5: Copy your Prisma schema folder FIRST before running generation
# (Adjust path if your prisma folder is inside src/ like src/prisma/schema.prisma)
COPY prisma ./prisma/

# Step 6: Generate the Prisma Client blueprint binary
RUN npx prisma generate

# Step 7: Copy the rest of your backend application source code
COPY . .

# Step 8: Document the network port your application listens on
EXPOSE 3000

# Step 9: Define the default command to start your Express execution loop
CMD sh -c "npx prisma migrate deploy && npm start"
