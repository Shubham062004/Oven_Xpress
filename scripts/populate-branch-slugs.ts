import { prisma } from '../src/lib/db/prisma';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function main() {
  const branches = await prisma.branch.findMany();
  const usedSlugs = new Set<string>();

  for (const b of branches) {
    let baseSlug = slugify(b.name) || slugify(b.code) || 'branch';
    let slug = baseSlug;
    let counter = 1;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    usedSlugs.add(slug);
    await prisma.branch.update({
      where: { id: b.id },
      data: { slug },
    });
    console.log(`Updated branch "${b.name}" (${b.code}) -> slug: "${slug}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
