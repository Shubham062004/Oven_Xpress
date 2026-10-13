import { prisma } from '../src/lib/db/prisma';

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`Connection attempt ${i + 1} failed (${err.message}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Retries exhausted');
}

const DEMO_STAFF_ASSIGNMENTS = [
  // Bandra
  { email: 'demo.mgr.bandra@ovenxpress.local', branchCode: 'DEMO-BR-01', code: 'EMP-BND-01', firstName: 'Rajesh', lastName: 'Verma', designation: 'Branch Manager', salary: 65000, phone: '+91 98201 10001' },
  { email: 'demo.chef.bandra@ovenxpress.local', branchCode: 'DEMO-BR-01', code: 'EMP-BND-02', firstName: 'Sanjay', lastName: 'Rawat', designation: 'Head Chef', salary: 42000, phone: '+91 98201 10002' },
  { email: 'demo.cashier.bandra@ovenxpress.local', branchCode: 'DEMO-BR-01', code: 'EMP-BND-03', firstName: 'Amit', lastName: 'Roy', designation: 'Cashier', salary: 26000, phone: '+91 98201 10003' },

  // Andheri (Sneha Patel is here!)
  { email: 'demo.mgr.andheri@ovenxpress.local', branchCode: 'DEMO-BR-02', code: 'EMP-AND-01', firstName: 'Pooja', lastName: 'Hegde', designation: 'Branch Manager', salary: 65000, phone: '+91 98201 20001' },
  { email: 'demo.chef.andheri@ovenxpress.local', branchCode: 'DEMO-BR-02', code: 'EMP-AND-02', firstName: 'Manoj', lastName: 'Tiwari', designation: 'Head Chef', salary: 42000, phone: '+91 98201 20002' },
  { email: 'demo.cashier.andheri@ovenxpress.local', branchCode: 'DEMO-BR-02', code: 'EMP-AND-03', firstName: 'Sneha', lastName: 'Patel', designation: 'Cashier', salary: 26000, phone: '+91 98201 20003' },

  // Koramangala
  { email: 'demo.mgr.koramangala@ovenxpress.local', branchCode: 'DEMO-BR-03', code: 'EMP-KOR-01', firstName: 'Karthik', lastName: 'Nair', designation: 'Branch Manager', salary: 65000, phone: '+91 98201 30001' },
  { email: 'demo.chef.koramangala@ovenxpress.local', branchCode: 'DEMO-BR-03', code: 'EMP-KOR-02', firstName: 'Venkatesh', lastName: 'Rao', designation: 'Head Chef', salary: 42000, phone: '+91 98201 30002' },
  { email: 'demo.cashier.koramangala@ovenxpress.local', branchCode: 'DEMO-BR-03', code: 'EMP-KOR-03', firstName: 'Sunita', lastName: 'Reddy', designation: 'Cashier', salary: 26000, phone: '+91 98201 30003' },

  // Indiranagar
  { email: 'demo.mgr.indiranagar@ovenxpress.local', branchCode: 'DEMO-BR-04', code: 'EMP-IND-01', firstName: 'Divya', lastName: 'Iyer', designation: 'Branch Manager', salary: 65000, phone: '+91 98201 40001' },
  { email: 'demo.chef.indiranagar@ovenxpress.local', branchCode: 'DEMO-BR-04', code: 'EMP-IND-02', firstName: 'Naveen', lastName: 'Kumar', designation: 'Head Chef', salary: 42000, phone: '+91 98201 40002' },
  { email: 'demo.cashier.indiranagar@ovenxpress.local', branchCode: 'DEMO-BR-04', code: 'EMP-IND-03', firstName: 'Kavita', lastName: 'Menon', designation: 'Cashier', salary: 26000, phone: '+91 98201 40003' },

  // Connaught Place
  { email: 'demo.mgr.cp@ovenxpress.local', branchCode: 'DEMO-BR-05', code: 'EMP-CP-01', firstName: 'Harpreet', lastName: 'Singh', designation: 'Branch Manager', salary: 65000, phone: '+91 98201 50001' },
  { email: 'demo.chef.cp@ovenxpress.local', branchCode: 'DEMO-BR-05', code: 'EMP-CP-02', firstName: 'Gurpreet', lastName: 'Chawla', designation: 'Head Chef', salary: 42000, phone: '+91 98201 50002' },
  { email: 'demo.cashier.cp@ovenxpress.local', branchCode: 'DEMO-BR-05', code: 'EMP-CP-03', firstName: 'Neha', lastName: 'Gupta', designation: 'Cashier', salary: 26000, phone: '+91 98201 50003' },
];

async function main() {
  console.log('Connecting to database...');

  // Fetch branches
  const branches = await withRetry(() => prisma.branch.findMany());
  const branchMap = new Map(branches.map((b) => [b.code, b.id]));

  for (const item of DEMO_STAFF_ASSIGNMENTS) {
    const branchId = branchMap.get(item.branchCode);
    if (!branchId) {
      console.warn(`Branch with code ${item.branchCode} not found!`);
      continue;
    }

    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { email: item.email },
      })
    );

    if (!user) {
      console.warn(`User ${item.email} not found!`);
      continue;
    }

    // Upsert employee linked to user and branch
    await withRetry(() =>
      prisma.employee.upsert({
        where: { employeeCode: item.code },
        update: {
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          designation: item.designation,
          branchId,
          userId: user.id,
          salary: item.salary,
          salaryType: 'MONTHLY',
          employmentStatus: 'ACTIVE',
        },
        create: {
          employeeCode: item.code,
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email,
          phone: item.phone,
          joiningDate: new Date('2024-01-15'),
          designation: item.designation,
          branchId,
          userId: user.id,
          salary: item.salary,
          salaryType: 'MONTHLY',
          employmentStatus: 'ACTIVE',
        },
      })
    );

    console.log(`✓ Linked ${item.firstName} ${item.lastName} (${item.designation}) -> Branch ${item.branchCode}`);
  }

  console.log('\nAll demo employees successfully linked!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
