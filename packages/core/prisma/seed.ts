import { PrismaClient, Role } from '@prisma/client';

const db = new PrismaClient();

const users: { email: string; name: string; role: Role }[] = [
  { email: 'admin@logistics.test', name: 'Platform Admin', role: 'ADMIN' },
  { email: 'manager@logistics.test', name: 'Operations Manager', role: 'MANAGER' },
  { email: 'driver@logistics.test', name: 'Demo Driver', role: 'DRIVER' },
  { email: 'agent@logistics.test', name: 'Booking Agent', role: 'AGENT' },
  { email: 'public@logistics.test', name: 'Public Customer', role: 'PUBLIC' },
];

async function main() {
  for (const user of users) {
    await db.user.upsert({ where: { email: user.email }, update: user, create: user });
  }
  const nigeria = await db.country.upsert({ where: { isoCode: 'NG' }, update: { name: 'Nigeria' }, create: { name: 'Nigeria', isoCode: 'NG' } });
  for (const [name, cities] of Object.entries({ Lagos: ['Ikeja', 'Lekki'], 'Federal Capital Territory': ['Abuja'], Kano: ['Kano'] })) {
    const state = await db.state.upsert({ where: { countryId_name: { countryId: nigeria.id, name } }, update: {}, create: { countryId: nigeria.id, name } });
    for (const city of cities) await db.city.upsert({ where: { stateId_name: { stateId: state.id, name: city } }, update: {}, create: { stateId: state.id, name: city } });
  }
  await db.agentControl.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton', status: 'RUNNING' } });
}

main().finally(() => db.$disconnect());
