import { pool, query } from "./src/config/db.js";

async function test() {
  const posts = await query("SELECT * FROM blog_posts");
  console.log("ALL POSTS:", posts);
  await pool.end();
}
test();
