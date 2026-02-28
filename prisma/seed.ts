import "dotenv/config";
import pkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient, MembershipRole } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
    // 1) Create a property
    const property = await prisma.property.create({
        data: {
            name: "Village Hotel",
            timezone: "Europe/London",
        },
    });

    // 2) Create users (for now: simple placeholder password hashes)
    // We'll replace these with real hashing when we build Auth.
    const adminUser = await prisma.user.create({
        data: {
            name: "Property Admin",
            email: "admin@villagehotel.test",
            passwordHash: "TEMP_NOT_SECURE",
        },
    });

    const chefUser = await prisma.user.create({
        data: {
            name: "Chef User",
            email: "chef@villagehotel.test",
            passwordHash: "TEMP_NOT_SECURE",
        },
    });

    // 3) Create memberships (roles scoped to the property)
    await prisma.propertyMembership.createMany({
        data: [
            {
                propertyId: property.id,
                userId: adminUser.id,
                role: MembershipRole.PROPERTY_ADMIN,
            },
            {
                propertyId: property.id,
                userId: chefUser.id,
                role: MembershipRole.PROPERTY_USER,
            },
        ],
    });

    console.log("Seed complete:");
    console.log({ propertyId: property.id, adminEmail: adminUser.email, chefEmail: chefUser.email });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });