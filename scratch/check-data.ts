import { prisma } from '../src/lib/db/prisma';

async function check() {
  const branches = await prisma.branch.findMany();
  console.log('BRANCHES:', JSON.stringify(branches.map(b => ({
    id: b.id,
    name: b.name,
    code: b.code,
    slug: b.slug,
    status: b.status,
    openingTime: b.openingTime,
    closingTime: b.closingTime,
  })), null, 2));

  const items = await prisma.menuItem.findMany({
    where: { status: 'ACTIVE' },
    include: { category: true },
  });
  console.log('MENU ITEMS:', items.length);
  console.log(items.map(i => ({
    id: i.id,
    name: i.name,
    category: i.category?.name,
    price: i.price,
    imageUrl: i.imageUrl,
    status: i.status,
  })));

  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log('SAMPLE ORDERS (check pickup / orderType fields):', orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderType: o.orderType,
    deliveryNotes: o.deliveryNotes,
    notes: o.notes,
  })));
}

check().finally(() => prisma.$disconnect());
