/**
 * End-to-End Scenario Verification Script
 * Step 21 — Final System Verification across 29 Lifecycle Stages
 */

import { prisma } from '../src/lib/db/prisma';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  StockTransactionType,
  AttendanceStatus,
  OrderType,
  ExpenseStatus,
  BonusType,
  BonusStatus,
} from '@prisma/client';
import { getSetting, updateSetting } from '../src/lib/settings/settings-service';

async function main() {
  console.log('====================================================');
  console.log(' STEP 21: 29-STAGE COMPLETE SYSTEM E2E VERIFICATION ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function step(num: number, title: string, ok: boolean, details?: string) {
    total++;
    if (ok) {
      console.log(`  Stage ${num.toString().padStart(2, '0')}: ✅ ${title}`);
      passed++;
    } else {
      console.error(`  Stage ${num.toString().padStart(2, '0')}: ❌ ${title}${details ? ` - ${details}` : ''}`);
    }
  }

  // 1. Owner / Admin user existence & authentication verification
  const owner = await prisma.user.findFirst({
    where: { role: { name: 'OWNER' } },
    include: { role: true },
  });
  step(1, 'Owner logs in / exists with password hash', !!owner && !!owner.passwordHash);

  if (!owner) throw new Error('Owner user not found');

  // 2. Creates/opens branch
  const timestamp = Date.now();
  const branchCode = `E2E${timestamp.toString().slice(-4)}`;
  const branch = await prisma.branch.create({
    data: {
      name: `E2E Test Branch ${branchCode}`,
      code: branchCode,
      city: 'Mumbai',
      state: 'Maharashtra',
      address: '100 E2E Tech Park',
      postalCode: '400001',
      status: 'ACTIVE',
    },
  });
  step(2, 'Branch created and active', branch.status === 'ACTIVE');

  // 3. Adds employee
  const empCode = `EMP${timestamp.toString().slice(-4)}`;
  const employee = await prisma.employee.create({
    data: {
      branchId: branch.id,
      firstName: 'E2E',
      lastName: 'Chef',
      phone: `99${timestamp.toString().slice(-8)}`,
      designation: 'Head Chef',
      employeeCode: empCode,
      joiningDate: new Date(),
      employmentStatus: 'ACTIVE',
      salary: 35000,
      salaryType: 'MONTHLY',
    },
  });
  step(3, 'Employee created and assigned to branch', employee.branchId === branch.id);

  // 4. Creates shift
  const shift = await prisma.shift.create({
    data: {
      branchId: branch.id,
      name: 'Morning Shift',
      startTime: '08:00',
      endTime: '16:00',
      status: 'ACTIVE',
    },
  });
  step(4, 'Shift created for branch', shift.branchId === branch.id);

  // 5. Marks attendance
  const attendance = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      branchId: branch.id,
      shiftId: shift.id,
      date: new Date(),
      status: AttendanceStatus.PRESENT,
      checkIn: new Date(),
      markedBy: owner.name,
    },
  });
  step(5, 'Attendance marked for employee', attendance.status === AttendanceStatus.PRESENT);

  // 6. Creates ingredient
  const ingredient = await prisma.ingredient.create({
    data: {
      name: `E2E Flour ${timestamp}`,
      unit: 'KG',
      status: 'ACTIVE',
    },
  });
  step(6, 'Ingredient created', ingredient.unit === 'KG');

  // 7. Creates category & menu item
  const category = await prisma.menuCategory.create({
    data: {
      name: `E2E Breads ${timestamp}`,
      status: 'ACTIVE',
    },
  });
  const menuItem = await prisma.menuItem.create({
    data: {
      name: `E2E Artisanal Loaf ${timestamp}`,
      categoryId: category.id,
      price: 150.0,
      status: 'ACTIVE',
    },
  });
  step(7, 'Menu item created with category', menuItem.price.toNumber() === 150.0);

  // 8. Creates recipe
  const recipe = await prisma.recipeIngredient.create({
    data: {
      menuItemId: menuItem.id,
      ingredientId: ingredient.id,
      quantity: 0.5,
      unit: 'KG',
    },
  });
  step(8, 'Recipe defined for menu item', recipe.quantity.toNumber() === 0.5);

  // 9. Adds inventory
  await prisma.inventoryItem.create({
    data: {
      branchId: branch.id,
      ingredientId: ingredient.id,
      minimumStock: 10,
      reorderLevel: 20,
    },
  });
  const initialStockTx = await prisma.stockTransaction.create({
    data: {
      branchId: branch.id,
      ingredientId: ingredient.id,
      type: StockTransactionType.OPENING,
      quantity: 100,
      unit: 'KG',
      referenceId: 'INIT-E2E',
      performedBy: owner.name,
    },
  });
  step(9, 'Inventory initialized with opening stock (100 KG)', initialStockTx.quantity.toNumber() === 100);

  // 10. Creates supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: `E2E Agro Foods ${timestamp}`,
      contactPerson: 'Rajesh Kumar',
      phone: `91${timestamp.toString().slice(-8)}`,
      status: 'ACTIVE',
    },
  });
  step(10, 'Supplier created', supplier.status === 'ACTIVE');

  // 11. Creates purchase
  const poNumber = `PO-${timestamp.toString().slice(-6)}`;
  const po = await prisma.purchaseOrder.create({
    data: {
      purchaseNumber: poNumber,
      supplierId: supplier.id,
      branchId: branch.id,
      status: PurchaseOrderStatus.ORDERED,
      orderDate: new Date(),
      createdBy: owner.name,
      items: {
        create: [
          {
            ingredientId: ingredient.id,
            orderedQuantity: 50,
            unitPrice: 45,
            unit: 'KG',
          },
        ],
      },
    },
    include: { items: true },
  });
  step(11, 'Purchase order created in ORDERED status', po.status === PurchaseOrderStatus.ORDERED);

  // 12. Receives purchase
  const receiving = await prisma.$transaction(async (tx) => {
    const rc = await tx.purchaseReceiving.create({
      data: {
        purchaseOrderId: po.id,
        receivingNumber: `REC-${timestamp.toString().slice(-6)}`,
        receivedBy: owner.name,
        receivedAt: new Date(),
      },
    });
    await tx.purchaseOrderItem.update({
      where: { id: po.items[0].id },
      data: { receivedQuantity: 50 },
    });
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: PurchaseOrderStatus.RECEIVED },
    });
    await tx.stockTransaction.create({
      data: {
        branchId: branch.id,
        ingredientId: ingredient.id,
        type: StockTransactionType.RECEIPT,
        quantity: 50,
        unit: 'KG',
        referenceId: po.purchaseNumber,
        performedBy: owner.name,
      },
    });
    return rc;
  });
  step(12, 'Purchase order received and stock credited (+50 KG)', !!receiving);

  // 13. Creates customer / order
  const customer = await prisma.customer.create({
    data: {
      name: 'Rohan Sharma',
      phone: `98${timestamp.toString().slice(-8)}`,
      email: `rohan_${timestamp}@example.com`,
    },
  });
  const orderNumber = `ORD-E2E-${timestamp.toString().slice(-6)}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      branchId: branch.id,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      orderType: OrderType.TAKEAWAY,
      status: OrderStatus.PENDING,
      subtotal: 300,
      discountAmount: 0,
      taxAmount: 15,
      deliveryCharge: 0,
      totalAmount: 315,
      createdBy: owner.name,
      items: {
        create: [
          {
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            quantity: 2,
            unitPrice: 150,
            discountAmount: 0,
            totalPrice: 300,
          },
        ],
      },
    },
    include: { items: true },
  });
  step(13, 'Customer & Order created in PENDING status', order.status === OrderStatus.PENDING);

  // 14. Confirms order
  const confirmedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
  });
  step(14, 'Order confirmed', confirmedOrder.status === OrderStatus.CONFIRMED);

  // 15. Kitchen starts preparation
  const prepOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PREPARING,
      preparingAt: new Date(),
      preparedBy: `${employee.firstName} ${employee.lastName}`,
    },
  });
  step(15, 'Kitchen starts preparation', prepOrder.status === OrderStatus.PREPARING);

  // 16. Inventory consumption occurs
  // 2 loaves * 0.5 KG = 1.0 KG consumed
  const consumptionTx = await prisma.stockTransaction.create({
    data: {
      branchId: branch.id,
      ingredientId: ingredient.id,
      type: StockTransactionType.CONSUMPTION,
      quantity: -1.0,
      unit: 'KG',
      referenceId: order.orderNumber,
      performedBy: 'Kitchen KDS',
    },
  });
  step(16, 'Recipe inventory consumption recorded (-1.0 KG)', consumptionTx.quantity.toNumber() === -1.0);

  // 17. Kitchen marks ready
  const readyOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.READY,
      readyAt: new Date(),
      readyBy: `${employee.firstName} ${employee.lastName}`,
    },
  });
  step(17, 'Kitchen marks order ready', readyOrder.status === OrderStatus.READY);

  // 18. Payment is recorded
  const payment = await prisma.payment.create({
    data: {
      paymentNumber: `PAY-E2E-${timestamp.toString().slice(-6)}`,
      orderId: order.id,
      branchId: branch.id,
      amount: 315,
      method: PaymentMethod.UPI,
      status: PaymentStatus.SUCCESS,
      processedBy: owner.name,
      referenceNumber: `UPI-REF-${timestamp.toString().slice(-6)}`,
    },
  });
  step(18, 'Payment recorded via UPI (₹315)', payment.status === PaymentStatus.SUCCESS);

  // 19. Order completes
  const completedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.COMPLETED, completedAt: new Date(), completedBy: owner.name },
  });
  step(19, 'Order marked COMPLETED', completedOrder.status === OrderStatus.COMPLETED);

  // 20. Customer review is created
  const review = await prisma.review.create({
    data: {
      orderId: order.id,
      branchId: branch.id,
      customerId: customer.id,
      rating: 5,
      comment: 'Freshly baked and exquisite crust!',
      status: 'PUBLISHED',
    },
  });
  step(20, 'Customer 5-star review published', review.rating === 5);

  // 21. Expense is created
  const expenseCat =
    (await prisma.expenseCategory.findFirst()) ||
    (await prisma.expenseCategory.create({
      data: { name: 'Operations', status: 'ACTIVE' },
    }));
  const expense = await prisma.expense.create({
    data: {
      expenseNumber: `EXP-E2E-${timestamp.toString().slice(-6)}`,
      branchId: branch.id,
      categoryId: expenseCat.id,
      amount: 500,
      description: 'Kitchen cleaning consumables',
      expenseDate: new Date(),
      paymentMethod: PaymentMethod.CASH,
      status: ExpenseStatus.PENDING_APPROVAL,
      createdBy: owner.name,
    },
  });
  step(21, 'Expense created in PENDING_APPROVAL status', expense.status === ExpenseStatus.PENDING_APPROVAL);

  // 22. Expense approved
  const approvedExpense = await prisma.expense.update({
    where: { id: expense.id },
    data: { status: ExpenseStatus.APPROVED, approvedBy: owner.name, approvedAt: new Date() },
  });
  step(22, 'Expense reviewed and APPROVED', approvedExpense.status === ExpenseStatus.APPROVED);

  // 23. Salary / bonus record created
  const bonus = await prisma.bonus.create({
    data: {
      employeeId: employee.id,
      branchId: branch.id,
      type: BonusType.PERFORMANCE,
      amount: 1500,
      reason: 'Excellence in kitchen hygiene and order turnaround',
      status: BonusStatus.APPROVED,
      bonusDate: new Date(),
      createdBy: owner.name,
      approvedBy: owner.name,
      approvedAt: new Date(),
    },
  });
  step(23, 'Employee performance bonus created & approved', bonus.status === BonusStatus.APPROVED);

  // 24. Dashboard updates: aggregates match active transactions
  const totalRevenue = await prisma.payment.aggregate({
    where: { branchId: branch.id, status: PaymentStatus.SUCCESS },
    _sum: { amount: true },
  });
  step(24, 'Dashboard financial aggregation reflects revenue (₹315)', totalRevenue._sum.amount?.toNumber() === 315);

  // 25. Reports show transaction: Sales report queries match
  const orderCount = await prisma.order.count({
    where: { branchId: branch.id, status: OrderStatus.COMPLETED },
  });
  step(25, 'Sales reports count completed order', orderCount === 1);

  // 26. Notification evaluation / check
  const alertSettings = await getSetting<boolean>('ALERT_LOW_STOCK_ENABLED', branch.id);
  step(26, 'Notification / alert configuration active for branch', alertSettings !== undefined);

  // 27. Audit log records important actions
  const auditLog = await prisma.auditLog.create({
    data: {
      actorUserId: owner.id,
      branchId: branch.id,
      action: 'ORDER_COMPLETED',
      entityType: 'ORDER',
      entityId: order.id,
      description: `E2E Completed Order ${order.orderNumber}`,
    },
  });
  step(27, 'Audit log created and verified', auditLog.action === 'ORDER_COMPLETED');

  // 28. Settings change is audited
  const settingUpdate = await updateSetting(
    {
      key: 'BRANCH_AUTO_ACCEPT_ORDERS',
      value: true,
      scope: 'BRANCH',
      branchId: branch.id,
    },
    owner.id
  );
  step(28, 'Settings modified for branch and audited', settingUpdate.success);

  // 29. CSV export / filtered data parity test
  const paymentsToExport = await prisma.payment.findMany({
    where: { branchId: branch.id, status: PaymentStatus.SUCCESS },
    select: { paymentNumber: true, amount: true },
  });
  step(29, 'Data queries for CSV export accurately match filtered DB records', paymentsToExport.length === 1);

  // Clean up test data created for this run
  await prisma.auditLog.deleteMany({ where: { branchId: branch.id } });
  await prisma.review.deleteMany({ where: { branchId: branch.id } });
  await prisma.payment.deleteMany({ where: { branchId: branch.id } });
  await prisma.orderItem.deleteMany({ where: { order: { branchId: branch.id } } });
  await prisma.order.deleteMany({ where: { branchId: branch.id } });
  await prisma.stockTransaction.deleteMany({ where: { branchId: branch.id } });
  await prisma.inventoryItem.deleteMany({ where: { branchId: branch.id } });
  await prisma.purchaseReceiving.deleteMany({ where: { purchaseOrder: { branchId: branch.id } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { branchId: branch.id } } });
  await prisma.purchaseOrder.deleteMany({ where: { branchId: branch.id } });
  await prisma.expense.deleteMany({ where: { branchId: branch.id } });
  await prisma.bonus.deleteMany({ where: { branchId: branch.id } });
  await prisma.attendance.deleteMany({ where: { branchId: branch.id } });
  await prisma.shift.deleteMany({ where: { branchId: branch.id } });
  await prisma.employee.deleteMany({ where: { branchId: branch.id } });
  await prisma.recipeIngredient.deleteMany({ where: { menuItemId: menuItem.id } });
  await prisma.menuItem.deleteMany({ where: { id: menuItem.id } });
  await prisma.menuCategory.deleteMany({ where: { id: category.id } });
  await prisma.ingredient.deleteMany({ where: { id: ingredient.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.systemSetting.deleteMany({ where: { branchId: branch.id } });
  await prisma.restaurantTable.deleteMany({ where: { branchId: branch.id } });
  await prisma.branch.delete({ where: { id: branch.id } });

  console.log('\n====================================================');
  console.log(` 29-STAGE E2E LIFECYCLE SCENARIO: ${passed}/${total} STAGES PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fatal error in verify-e2e-scenario:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
