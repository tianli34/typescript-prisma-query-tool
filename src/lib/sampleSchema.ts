export const SAMPLE_SCHEMA = `// Sample Prisma Schema — Blog Platform

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  bio       String?
  role      Role      @default(USER)
  posts     Post[]
  comments  Comment[]
  likes     Like[]
  profile   Profile?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Profile {
  id        Int     @id @default(autoincrement())
  userId    Int     @unique
  user      User    @relation(fields: [userId], references: [id])
  avatar    String?
  website   String?
  location  String?
}

model Post {
  id          Int       @id @default(autoincrement())
  title       String
  slug        String    @unique
  content     String
  published   Boolean   @default(false)
  authorId    Int
  author      User      @relation(fields: [authorId], references: [id])
  tags        Tag[]
  comments    Comment[]
  likes       Like[]
  categoryId  Int?
  category    Category? @relation(fields: [categoryId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([authorId])
  @@index([slug])
}

model Comment {
  id        Int      @id @default(autoincrement())
  content   String
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  postId    Int
  post      Post     @relation(fields: [postId], references: [id])
  createdAt DateTime @default(now())
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]
}

model Like {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  postId    Int
  post      Post     @relation(fields: [postId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, postId])
}

model Category {
  id       Int    @id @default(autoincrement())
  name     String @unique
  slug     String @unique
  posts    Post[]
  parentId Int?
  parent   Category?  @relation("CategoryToCategory", fields: [parentId], references: [id])
  children Category[] @relation("CategoryToCategory")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
`;
