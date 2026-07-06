import AppDataSource from '../data-source'
import { Post } from 'src/posts/entities/post.entity'
import { renderMarkdownToHtml } from 'src/posts/providers/render-post-content.util'

const BATCH_SIZE = 50

/**
 * One-off script: re-renders contentHtml for every existing post whose
 * content is not yet reflected in contentHtml (e.g. rows created before the
 * contentHtml column existed). Not wired into any npm script — run manually
 * with the same NODE_ENV pattern as the seed scripts:
 *   NODE_ENV=development ts-node -r tsconfig-paths/register src/database/scripts/backfill-post-content-html.ts
 */
async function main() {
  await AppDataSource.initialize()
  const postsRepository = AppDataSource.getRepository(Post)

  let offset = 0
  let updated = 0
  for (;;) {
    const posts: Post[] = await postsRepository.find({
      where: {},
      skip: offset,
      take: BATCH_SIZE,
      order: { id: 'ASC' },
    })
    if (posts.length === 0) break

    for (const post of posts) {
      if (post.content) {
        post.contentHtml = renderMarkdownToHtml(post.content)
        await postsRepository.save(post)
        updated++
      }
    }

    offset += BATCH_SIZE
  }

  console.log(`Backfilled contentHtml for ${updated} post(s).`)
  await AppDataSource.destroy()
}

main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})
