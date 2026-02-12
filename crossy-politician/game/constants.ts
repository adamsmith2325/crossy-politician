export const COLS = 9;
export const ROWS = 14;
export const ROAD_PROBABILITY = 0.85; // NYC is mostly roads!
export const MIN_CAR_GAP = 2;

// Palette – NYC-themed urban colors
export const C = {
  grass1: '#3D5A3F', // Muted urban park green (less vibrant)
  grass2: '#344D36', // Darker muted park green
  road: '#3A3A3A', // NYC asphalt gray
  roadEdge: '#2A2A2A', // Darker road edge
  roadDash: '#FFE44D', // Bright yellow road markings
  sidewalk: '#8B8680', // Concrete sidewalk
  sidewalkDark: '#757270', // Darker concrete
  treeLeaf: '#3D5A3F', // Muted park tree green
  treeLeaf2: '#344D36', // Darker tree green
  treeTrunk: '#5D4037', // Tree trunk brown
  carBody: '#FF4422', // Bright red (classic NYC cab alternative)
  carBody2: '#FFD700', // Yellow (NYC taxi)
  carRoof: '#FFFFFF', // Pure white
  carWheel: '#0A0A0A', // Deeper black
  truckBody: '#E8EEF7',
  truckCab: '#E62E2E', // Vibrant red
  shadow: 'rgba(0,0,0,0.3)', // Stronger urban shadows
  player: '#FFCC33', // Bright yellow
  building: '#B8B8B8', // Light gray building
  buildingDark: '#8A8A8A', // Dark gray building
  buildingWindow: '#87CEEB', // Sky blue windows
  buildingBrick: '#A0522D', // Brick red
  nycYellow: '#F7B731', // NYC taxi yellow
};
export const TILE_SIZE_MULTIPLIER = 1;
