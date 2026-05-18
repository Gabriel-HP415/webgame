export interface MapWaypoint {
  x: number;
  y: number;
}

export interface MapLane {
  id: number;
  waypoints: MapWaypoint[];
}

export interface MapSlot {
  id: string;
  x: number;
  y: number;
  lane: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  lanes: MapLane[];
  slots: MapSlot[];
  basePosition: { x: number; y: number };
  spawnPosition: { x: number; y: number };
  modifiers?: string[];
}
