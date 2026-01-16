import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import 'dotenv/config';


let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (prisma) return prisma;

  const url = process.env.DATABASE_URL;
  // console.log(url)
  if (!url) {
    const msg = 'DATABASE_URL is not set. Database operations will fail until it is configured.';
    console.warn(msg);
    return prisma;
  }

  try {
    //Use the official Postgres adapter for Prisma 7
    const adapter = new PrismaPg({ connectionString: url });
    prisma = new PrismaClient({ adapter });
    return prisma;
  } catch (err) {
    const msg = 'Prisma initialization failed: ' + ((err as Error).message ?? String(err));
    console.error(msg);
    return prisma;
  }
}

