import { db } from '../db';

export const listCountries = () => db.country.findMany({ orderBy: { name: 'asc' } });

export const listStates = (countryId: string) =>
  db.state.findMany({ where: { countryId }, orderBy: { name: 'asc' } });

export const listCities = (stateId: string) =>
  db.city.findMany({ where: { stateId }, orderBy: { name: 'asc' } });
