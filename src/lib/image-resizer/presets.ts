export interface Placement {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface ClientPreset {
  id: string;
  name: string;
  placements: Placement[];
}

const STORAGE_KEY = 'image-resizer-presets';

export const DEFAULT_PRESETS: ClientPreset[] = [
  {
    id: 'default',
    name: 'Default',
    placements: [
      { id: 'blog-hero', name: 'Blog Hero / Featured', width: 1200, height: 630 },
      { id: 'inline-image', name: 'Inline Image', width: 800, height: 500 },
      { id: 'thumbnail', name: 'Thumbnail', width: 400, height: 300 },
      { id: 'vcta', name: 'vCTA', width: 1200, height: 300 },
    ],
  },
];

function isValidPresets(data: unknown): data is ClientPreset[] {
  return (
    Array.isArray(data) &&
    data.every(
      (c) =>
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        Array.isArray(c.placements) &&
        c.placements.every(
          (p: unknown) =>
            typeof (p as Placement).id === 'string' &&
            typeof (p as Placement).name === 'string' &&
            typeof (p as Placement).width === 'number' &&
            (p as Placement).width > 0 &&
            typeof (p as Placement).height === 'number' &&
            (p as Placement).height > 0
        )
    )
  );
}

export function getPresets(): ClientPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isValidPresets(parsed)) return parsed;
    }
  } catch {
    // ignore parse errors, fall through to defaults
  }
  return DEFAULT_PRESETS;
}

export function savePresets(presets: ClientPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    throw new Error('Could not save presets — browser storage may be full.');
  }
}

export function addClient(presets: ClientPreset[], name: string): ClientPreset[] {
  const updated = [
    ...presets,
    { id: crypto.randomUUID(), name, placements: [] },
  ];
  savePresets(updated);
  return updated;
}

export function deleteClient(presets: ClientPreset[], clientId: string): ClientPreset[] {
  const updated = presets.filter((c) => c.id !== clientId);
  savePresets(updated);
  return updated;
}

export function addPlacement(
  presets: ClientPreset[],
  clientId: string,
  placement: Omit<Placement, 'id'>
): ClientPreset[] {
  const updated = presets.map((client) => {
    if (client.id !== clientId) return client;
    return {
      ...client,
      placements: [...client.placements, { ...placement, id: crypto.randomUUID() }],
    };
  });
  savePresets(updated);
  return updated;
}

export function deletePlacement(
  presets: ClientPreset[],
  clientId: string,
  placementId: string
): ClientPreset[] {
  const updated = presets.map((client) => {
    if (client.id !== clientId) return client;
    return {
      ...client,
      placements: client.placements.filter((p) => p.id !== placementId),
    };
  });
  savePresets(updated);
  return updated;
}

export function updateClientName(
  presets: ClientPreset[],
  clientId: string,
  name: string
): ClientPreset[] {
  const updated = presets.map((client) =>
    client.id === clientId ? { ...client, name } : client
  );
  savePresets(updated);
  return updated;
}
