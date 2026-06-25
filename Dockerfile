# Step 1: Use Node 22 (Mandatory for Prisma 7 engines)
FROM node:22-alpine

# Step 2: Set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Step 4: Install all application dependencies safely
RUN npm install

# Step 5: Copy your Prisma schema folder AND your new config file
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN DATABASE_URL="postgresql://mock:mock@localhost:5432/mock" npx prisma generate

# Step 7: Copy the rest of your backend application source code
COPY . .

# Step 8: Document the network port your application listens on
EXPOSE 3000

# Step 9: Define the default command to start your Express execution loop
CMD sh -c "npx prisma migrate deploy && npm start"
