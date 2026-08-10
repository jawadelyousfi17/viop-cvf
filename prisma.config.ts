import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// One place for secrets. Next.js reads .env.local and the Prisma CLI does not,
// so without this the app and the migration tool disagree about which database
// they are talking to — and the one that is wrong is always the CLI, silently.
config({ path: ['.env.local', '.env'], quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
