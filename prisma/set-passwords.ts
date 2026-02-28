import "dotenv/config";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "admin@villagehotel.test";
  const chefEmail = "chef@villagehotel.test";

  const adminHash = await bcrypt.hash("Admin123!", 10);
  const chefHash = await bcrypt.hash("Chef123!", 10);

  const admin = await prisma.user.update({
    where: { email: adminEmail },
    data: { passwordHash: adminHash },
  });

  const chef = await prisma.user.update({
    where: { email: chefEmail },
    data: { passwordHash: chefHash },
  });

  console.log("Passwords set:");
  console.log({ admin: admin.email, chef: chef.email });
  console.log("Login creds:");
  console.log("admin@villagehotel.test / Admin123!");
  console.log("chef@villagehotel.test / Chef123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
