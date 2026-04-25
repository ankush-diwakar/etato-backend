import prisma from './src/config/db.js';

async function test() {
  const posts = await prisma.blogPost.findMany();
  console.log("ALL POSTS:", posts);
  await prisma.$disconnect();
}
test();
