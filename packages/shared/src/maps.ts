import type { MapDefinition } from './mapTypes.js';
import neonCrossroads from '../maps/neon_crossroads.json';
import neonGrid from '../maps/neon_grid.json';

export interface MapCatalogEntry {
  id: string;
  label: string;
  description: string;
  def: MapDefinition;
}

export const MAP_CATALOG: Record<string, MapCatalogEntry> = {
  neon_grid: {
    id: 'neon_grid',
    label: 'Neon Grid',
    description: 'Bản nhỏ — 2 đường, luyện tập nhanh.',
    def: neonGrid as MapDefinition,
  },
  neon_crossroads: {
    id: 'neon_crossroads',
    label: 'Neon Crossroads',
    description: 'Bản rộng — 5 nhánh hội tụ ngã ba, nhiều slot (sẵn sàng boss).',
    def: neonCrossroads as MapDefinition,
  },
};

export const DEFAULT_MAP_ID = 'neon_crossroads';

export type MapId = keyof typeof MAP_CATALOG;

export function resolveMapId(id: string | null | undefined): string {
  if (id && id in MAP_CATALOG) return id;
  return DEFAULT_MAP_ID;
}

export function getMapDefinition(id: string | null | undefined): MapDefinition {
  return MAP_CATALOG[resolveMapId(id)].def;
}

export function listMaps(): MapCatalogEntry[] {
  return Object.values(MAP_CATALOG);
}
