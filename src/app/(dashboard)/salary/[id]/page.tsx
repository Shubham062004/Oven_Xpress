import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSalaryRecordById } from '@/lib/salary/actions';
import { SalaryDetailClient } from '@/components/salary/salary-detail-client';

interface SalaryDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SalaryDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getSalaryRecordById(id);

  if (!res.success || !res.data) {
    return { title: 'Salary Record Not Found | Oven Xpress' };
  }

  return {
    title: `${res.data.salaryNumber} - Compensation Review | Oven Xpress`,
    description: `Salary breakdown and attendance summary for ${res.data.employee.firstName} ${res.data.employee.lastName}.`,
  };
}

export default async function SalaryDetailPage({ params }: SalaryDetailPageProps) {
  await requirePermission(PERMISSIONS.SALARY_READ);
  const { id } = await params;

  const res = await getSalaryRecordById(id);

  if (!res.success || !res.data) {
    notFound();
  }

  return <SalaryDetailClient record={res.data} />;
}
