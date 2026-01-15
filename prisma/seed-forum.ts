import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding forum data...');

  // Check if test user exists, if not create one
  let testUser = await prisma.user.findFirst({
    where: { OR: [{ email: 'test@rideway.ge' }, { username: 'testuser' }] }
  });

  if (!testUser) {
    const passwordHash = await bcrypt.hash('Test123!', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'test@rideway.ge',
        username: 'testuser',
        fullName: 'Test User',
        passwordHash,
        isVerified: true,
        isActive: true,
      }
    });
    console.log('Created test user:', testUser.username);
  } else {
    console.log('Using existing user:', testUser.username);
  }

  // Create forum categories if they don't exist
  const categories = [
    { name: 'ზოგადი', description: 'ზოგადი დისკუსიები', icon: '💬', order: 1 },
    { name: 'ტექნიკური', description: 'ტექნიკური კითხვები და პასუხები', icon: '🔧', order: 2 },
    { name: 'ღონისძიებები', description: 'მოტო ღონისძიებები', icon: '📅', order: 3 },
    { name: 'მოგზაურობა', description: 'მარშრუტები და მოგზაურობა', icon: '🗺️', order: 4 },
  ];

  for (const cat of categories) {
    const existing = await prisma.forumCategory.findFirst({
      where: { name: cat.name }
    });

    if (!existing) {
      await prisma.forumCategory.create({
        data: cat
      });
      console.log('Created category:', cat.name);
    }
  }

  // Get a category for test thread
  const generalCat = await prisma.forumCategory.findFirst({
    where: { name: 'ზოგადი' }
  });

  // Create test threads if none exist
  const threadCount = await prisma.forumThread.count();
  if (threadCount === 0 && generalCat) {
    const threads = [
      { title: 'მოგესალმებით ფორუმზე!', content: 'გამარჯობა, ეს არის ტესტ თემა ფორუმის შესამოწმებლად.' },
      { title: 'რომელი მოტოციკლი ირჩევთ პირველისთვის?', content: 'დამწყებთათვის რომელ მოტოციკლს ურჩევთ?' },
      { title: 'ზაფხულის მარშრუტები საქართველოში', content: 'გაგვიზიარეთ თქვენი საყვარელი მარშრუტები.' },
    ];

    for (const thread of threads) {
      await prisma.forumThread.create({
        data: {
          ...thread,
          userId: testUser.id,
          categoryId: generalCat.id,
        }
      });
      console.log('Created thread:', thread.title);
    }
  }

  console.log('Forum seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
