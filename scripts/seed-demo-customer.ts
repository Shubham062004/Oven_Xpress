import { prisma } from '../src/lib/db/prisma';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const customerRole = await prisma.role.findUnique({
    where: { name: 'CUSTOMER' },
  });

  if (!customerRole) {
    console.error('CUSTOMER role not found!');
    return;
  }

  const email = 'customer@ovenxpress.com';
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log('Demo customer already exists:', existingUser.id);
    return;
  }

  const hashedPassword = await hashPassword('Customer123!');

  const user = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email,
      phone: '+919876543210',
      passwordHash: hashedPassword,
      roleId: customerRole.id,
      isActive: true,
      emailVerified: new Date(),
      addresses: [
        {
          id: 'addr_home',
          label: 'Home',
          street: 'Flat 402, Sunshine Apartments, Hill Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          landmark: 'Near Mehboob Studio',
          isDefault: true,
        },
        {
          id: 'addr_work',
          label: 'Work',
          street: 'Level 5, One BKC, G Block',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400051',
          landmark: 'Next to MCA Club',
          isDefault: false,
        },
      ],
    },
  });

  await prisma.customer.upsert({
    where: { phone: '+919876543210' },
    update: {
      userId: user.id,
      email: user.email,
      name: user.name,
      address: 'Flat 402, Sunshine Apartments, Hill Road, Bandra West, Mumbai 400050',
    },
    create: {
      userId: user.id,
      name: user.name,
      phone: '+919876543210',
      email: user.email,
      address: 'Flat 402, Sunshine Apartments, Hill Road, Bandra West, Mumbai 400050',
      status: 'ACTIVE',
    },
  });

  console.log('Successfully created demo customer account: customer@ovenxpress.com / Customer123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
