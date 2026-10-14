import { prisma } from '@/lib/db/prisma';

export interface PublicBranch {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  openingTime: string | null;
  closingTime: string | null;
  isOpenNow: boolean;
  status: string;
}

export function isBranchCurrentlyOpen(openingTime: string | null, closingTime: string | null): boolean {
  if (!openingTime || !closingTime) return true; // Default to open if not specified
  try {
    const now = new Date();
    // Use Indian Standard Time or local hour/minute
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);

    const openTotal = openH * 60 + (openM || 0);
    const closeTotal = closeH * 60 + (closeM || 0);

    if (closeTotal > openTotal) {
      return currentTotalMinutes >= openTotal && currentTotalMinutes <= closeTotal;
    } else {
      // Overnight (e.g. 18:00 to 02:00)
      return currentTotalMinutes >= openTotal || currentTotalMinutes <= closeTotal;
    }
  } catch {
    return true;
  }
}

export async function getPublicBranches(): Promise<PublicBranch[]> {
  const branches = await prisma.branch.findMany({
    where: {
      status: 'ACTIVE',
    },
    orderBy: {
      name: 'asc',
    },
  });

  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    slug: b.slug || b.code.toLowerCase(),
    description: b.description,
    address: b.address,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    phone: b.phone,
    email: b.email,
    openingTime: b.openingTime,
    closingTime: b.closingTime,
    isOpenNow: isBranchCurrentlyOpen(b.openingTime, b.closingTime),
    status: b.status,
  }));
}

export async function getPublicBranchBySlug(slug: string): Promise<PublicBranch | null> {
  const branch = await prisma.branch.findFirst({
    where: {
      OR: [
        { slug },
        { code: { equals: slug, mode: 'insensitive' } },
      ],
      status: 'ACTIVE',
    },
  });

  if (!branch) return null;

  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    slug: branch.slug || branch.code.toLowerCase(),
    description: branch.description,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    postalCode: branch.postalCode,
    phone: branch.phone,
    email: branch.email,
    openingTime: branch.openingTime,
    closingTime: branch.closingTime,
    isOpenNow: isBranchCurrentlyOpen(branch.openingTime, branch.closingTime),
    status: branch.status,
  };
}
