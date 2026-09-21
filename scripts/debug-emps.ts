import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const emps = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, branchId: true },
  });
  console.log('Total emps:', emps.length);
  console.log('Sample IDs & Codes:', emps.slice(0, 10));
}
main().finally(() => prisma.$disconnect());
