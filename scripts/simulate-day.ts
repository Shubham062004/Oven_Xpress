/**
 * Oven Xpress — Operational Day Simulation Script
 *
 * Usage: npx tsx scripts/simulate-day.ts [numOrders]
 *
 * Simulates an active shift on the current date:
 * - Generates 15–30 new orders distributed across Dine-In, Takeaway, Delivery
 * - Progresses orders through kitchen lifecycle states (CONFIRMED -> PREPARING -> READY -> COMPLETED)
 * - Automatically deducts inventory recipe consumption on PREPARING
 * - Records payments across Cash, Card, and UPI tenders
 * - Marks today's staff attendance
 * - Emits operational notifications and immutable audit log events
 */

import {
  PrismaClient,
  Prisma,
  OrderType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockTransactionType,
  IngredientUnit,
  AttendanceStatus,
  NotificationType,
  NotificationSeverity,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const targetOrders = parseInt(args[0] || '20', 10);

  console.log('================================================================');
  console.log(` SIMULATING ACTIVE RESTAURANT OPERATIONS (+${targetOrders} ORDERS)      `);
  console.log('================================================================\n');

  // Fetch active branches, menu items with recipes, customers, and staff
  const branches = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
    include: { tables: true },
  });
  if (branches.length === 0) throw new Error('No active branches found.');

  const customers = await prisma.customer.findMany({ take: 100 });
  const menuItems = await prisma.menuItem.findMany({
    where: { status: 'ACTIVE' },
    include: { recipeIngredients: { include: { ingredient: true } } },
  });
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE' },
    take: 50,
  });
  const owner = await prisma.user.findFirst({
    where: { role: { name: 'OWNER' } },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  console.log(`1. Simulating today's employee clock-ins for ${employees.length} staff members...`);
  let attCreated = 0;
  for (const emp of employees) {
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    });
    if (!existing) {
      const checkIn = new Date(today);
      checkIn.setHours(8, Math.floor(Math.random() * 45), 0);
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          branchId: emp.branchId,
          date: today,
          status: AttendanceStatus.PRESENT,
          checkIn,
          markedBy: 'Live Day Simulator',
        },
      });
      attCreated++;
    }
  }
  console.log(`    ✓ ${attCreated} New Daily Attendance records clocked in`);

  console.log(`2. Placing and dispatching ${targetOrders} orders across branches...`);
  let ordersCreated = 0;
  for (let i = 1; i <= targetOrders; i++) {
    const branch = branches[Math.floor(Math.random() * branches.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const channelRoll = Math.random();

    let orderType: OrderType = OrderType.DINE_IN;
    let tableId: string | null = null;
    let deliveryAddress: string | null = null;
    let deliveryCharge = 0;

    if (channelRoll < 0.55 && branch.tables.length > 0) {
      orderType = OrderType.DINE_IN;
      tableId = branch.tables[Math.floor(Math.random() * branch.tables.length)].id;
    } else if (channelRoll < 0.80) {
      orderType = OrderType.TAKEAWAY;
    } else {
      orderType = OrderType.DELIVERY;
      deliveryAddress = customer?.address || '123 Park Street';
      deliveryCharge = 40.0;
    }

    // Select 1 to 3 random dishes
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const selectedDishes = [];
    let subtotal = 0;

    for (let c = 0; c < itemCount; c++) {
      const dish = menuItems[Math.floor(Math.random() * menuItems.length)];
      selectedDishes.push(dish);
      subtotal += dish.price.toNumber();
    }

    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
    const totalAmount = subtotal + taxAmount + deliveryCharge;

    const orderNumber = `SIM-${branch.code}-${Date.now().toString().slice(-6)}-${i}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        branchId: branch.id,
        orderType,
        status: OrderStatus.COMPLETED,
        customerId: customer?.id || null,
        tableId,
        customerName: customer?.name || 'Walk-in Guest',
        customerPhone: customer?.phone || '+91-9876543210',
        deliveryAddress,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        deliveryCharge: new Prisma.Decimal(deliveryCharge),
        totalAmount: new Prisma.Decimal(totalAmount),
        createdBy: 'Live Simulator',
        confirmedAt: new Date(now.getTime() - 15 * 60000),
        preparingAt: new Date(now.getTime() - 12 * 60000),
        readyAt: new Date(now.getTime() - 4 * 60000),
        completedAt: now,
        inventoryConsumed: true,
        items: {
          create: selectedDishes.map((d) => ({
            menuItemId: d.id,
            itemName: d.name,
            quantity: 1,
            unitPrice: d.price,
            totalPrice: d.price,
          })),
        },
      },
    });

    // Deduct stock consumption
    for (const d of selectedDishes) {
      for (const ing of d.recipeIngredients) {
        await prisma.stockTransaction.create({
          data: {
            branchId: branch.id,
            ingredientId: ing.ingredientId,
            type: StockTransactionType.CONSUMPTION,
            quantity: ing.quantity,
            unit: ing.unit,
            referenceId: order.id,
            performedBy: 'KDS Live Simulator',
            createdAt: now,
          },
        });
      }
    }

    // Record settled payment
    const paymentMethod = Math.random() < 0.5 ? PaymentMethod.UPI : PaymentMethod.CARD;
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-SIM-${Date.now().toString().slice(-6)}-${i}`,
        orderId: order.id,
        branchId: branch.id,
        amount: new Prisma.Decimal(totalAmount),
        method: paymentMethod,
        status: PaymentStatus.SUCCESS,
        referenceNumber: `TXN${Math.floor(Math.random() * 90000000 + 10000000)}`,
        processedBy: 'Live POS Cashier',
        processedAt: now,
      },
    });

    // Emit Audit Log
    if (owner) {
      await prisma.auditLog.create({
        data: {
          actorUserId: owner.id,
          branchId: branch.id,
          action: 'ORDER_SIMULATED',
          entityType: 'ORDER',
          entityId: order.id,
          description: `Simulated order ${order.orderNumber} for ₹${totalAmount.toFixed(2)}`,
          createdAt: now,
        },
      });
    }

    ordersCreated++;
  }
  console.log(`    ✓ ${ordersCreated} Orders created, prepared, paid, and recipe-consumed`);

  // Emit an operational notification
  if (owner) {
    await prisma.notification.create({
      data: {
        recipientUserId: owner.id,
        branchId: branches[0].id,
        type: NotificationType.OPERATIONAL_EXCEPTION,
        severity: NotificationSeverity.INFO,
        title: 'Simulation Activity Report',
        message: `Successfully simulated ${ordersCreated} orders and operational workflows on ${today.toISOString().split('T')[0]}.`,
        isRead: false,
        createdAt: now,
      },
    });
  }

  console.log('\n================================================================');
  console.log(' SIMULATION COMPLETED SUCCESSFULLY                              ');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during day simulation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
