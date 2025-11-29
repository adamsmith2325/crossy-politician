import * as THREE from 'three';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow';
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export interface EnvironmentConfig {
  season: Season;
  weather: Weather;
  timeOfDay: TimeOfDay;
}

export interface LightingConfig {
  skyColor: number;
  groundColor: number;
  hemisphereIntensity: number;
  directionalColor: number;
  directionalIntensity: number;
  ambientColor: number;
  ambientIntensity: number;
  fogColor: number;
  fogDensity: number;
}

export interface BuildingColors {
  primary: number[];
  accent: number[];
  windowLit: number;
  windowDark: number;
  windowEmissive: number;
}

/**
 * Generate random environment configuration
 */
export function generateRandomEnvironment(): EnvironmentConfig {
  const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const timesOfDay: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

  const season = seasons[Math.floor(Math.random() * seasons.length)];
  const timeOfDay = timesOfDay[Math.floor(Math.random() * timesOfDay.length)];

  // Weather depends on season
  let weather: Weather;
  if (season === 'winter') {
    weather = Math.random() < 0.4 ? 'snow' : Math.random() < 0.5 ? 'cloudy' : 'clear';
  } else if (season === 'spring' || season === 'fall') {
    weather = Math.random() < 0.3 ? 'rain' : Math.random() < 0.4 ? 'cloudy' : 'clear';
  } else {
    weather = Math.random() < 0.2 ? 'rain' : Math.random() < 0.3 ? 'cloudy' : 'clear';
  }

  return { season, weather, timeOfDay };
}

/**
 * Get lighting configuration based on environment
 */
export function getLightingConfig(env: EnvironmentConfig): LightingConfig {
  const { timeOfDay, weather } = env;

  // Base configs for different times of day
  const timeConfigs: Record<TimeOfDay, LightingConfig> = {
    morning: {
      skyColor: 0xffd89b,
      groundColor: 0x8b6f47,
      hemisphereIntensity: 1.2, // Brighter morning glow
      directionalColor: 0xffeaa7,
      directionalIntensity: 1.0, // Enhanced directional light
      ambientColor: 0xffd89b,
      ambientIntensity: 0.6, // Warmer ambient fill
      fogColor: 0xffd89b,
      fogDensity: 0.002,
    },
    day: {
      skyColor: 0x87ceeb,
      groundColor: 0x7cb342,
      hemisphereIntensity: 1.4, // Increased for brighter, more vibrant scene
      directionalColor: 0xfff5e6, // Slightly warmer white for golden tint
      directionalIntensity: 1.2, // Stronger shadows and depth
      ambientColor: 0xb3d9ff,
      ambientIntensity: 0.7, // Boosted ambient for less harsh shadows
      fogColor: 0xcce5ff,
      fogDensity: 0.001,
    },
    evening: {
      skyColor: 0xff7e5f,
      groundColor: 0x5f4842,
      hemisphereIntensity: 1.0, // Warmer evening light
      directionalColor: 0xff9966,
      directionalIntensity: 0.8, // Enhanced golden hour lighting
      ambientColor: 0xff9966,
      ambientIntensity: 0.6, // Richer ambient glow
      fogColor: 0xffa07a,
      fogDensity: 0.003,
    },
    night: {
      skyColor: 0x1a1a2e,
      groundColor: 0x0f0f1e,
      hemisphereIntensity: 0.4,
      directionalColor: 0x6b7c99,
      directionalIntensity: 0.3,
      ambientColor: 0x2d3561,
      ambientIntensity: 0.4,
      fogColor: 0x1a1a2e,
      fogDensity: 0.004,
    },
  };

  const config = { ...timeConfigs[timeOfDay] };

  // Modify based on weather
  if (weather === 'cloudy') {
    config.hemisphereIntensity *= 0.7;
    config.directionalIntensity *= 0.6;
    config.fogDensity *= 1.5;
  } else if (weather === 'rain') {
    config.hemisphereIntensity *= 0.6;
    config.directionalIntensity *= 0.5;
    config.ambientIntensity *= 0.8;
    config.fogDensity *= 2;
  } else if (weather === 'snow') {
    config.skyColor = 0xd4d4dc;
    config.fogColor = 0xe8e8f0;
    config.hemisphereIntensity *= 0.9;
    config.fogDensity *= 1.8;
  }

  return config;
}

/**
 * Get building color palette based on environment
 */
export function getBuildingColors(env: EnvironmentConfig): BuildingColors {
  const { timeOfDay, season } = env;

  // Modern building colors - lighter and more varied
  const primaryColors: number[][] = [
    [0xe8eaf6, 0xc5cae9, 0x9fa8da], // Light indigo variations
    [0xfce4ec, 0xf8bbd0, 0xf48fb1], // Light pink variations
    [0xe0f7fa, 0xb2ebf2, 0x80deea], // Light cyan variations
    [0xfff9c4, 0xfff59d, 0xfff176], // Light yellow variations
    [0xe8f5e9, 0xc8e6c9, 0xa5d6a7], // Light green variations
    [0xfff3e0, 0xffe0b2, 0xffcc80], // Light orange variations
  ];

  const accentColors: number[][] = [
    [0x5c6bc0, 0x3f51b5, 0x283593], // Indigo accents
    [0xec407a, 0xe91e63, 0xc2185b], // Pink accents
    [0x26c6da, 0x00bcd4, 0x0097a7], // Cyan accents
    [0xffee58, 0xffeb3b, 0xfbc02d], // Yellow accents
    [0x66bb6a, 0x4caf50, 0x388e3c], // Green accents
    [0xffa726, 0xff9800, 0xf57c00], // Orange accents
  ];

  const paletteIndex = Math.floor(Math.random() * primaryColors.length);

  let windowLit = 0xffd966;
  let windowDark = 0x2a2f3a;
  let windowEmissive = 0x664400;

  // Adjust window colors based on time of day
  if (timeOfDay === 'night' || timeOfDay === 'evening') {
    windowLit = 0xffecb3;
    windowEmissive = 0x996600;
  } else if (timeOfDay === 'morning') {
    windowLit = 0xfff9e6;
    windowEmissive = 0x886600;
  }

  return {
    primary: primaryColors[paletteIndex],
    accent: accentColors[paletteIndex],
    windowLit,
    windowDark,
    windowEmissive,
  };
}

/**
 * Get seasonal decoration color
 */
export function getSeasonalDecoration(season: Season): { color: number; type: string } | null {
  switch (season) {
    case 'winter':
      return { color: 0xffffff, type: 'snow' };
    case 'spring':
      return { color: 0xffb6c1, type: 'flowers' };
    case 'fall':
      return { color: 0xff8c00, type: 'leaves' };
    default:
      return null;
  }
}

/**
 * Create weather particles
 */
export function createWeatherParticles(
  scene: THREE.Scene,
  weather: Weather,
  playerPosition: THREE.Vector3
): THREE.Points | null {
  if (weather === 'clear' || weather === 'cloudy') {
    return null;
  }

  const particleCount = weather === 'rain' ? 120 : 60; // OPTIMIZED: Further reduced for better performance
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 20;
    positions[i3 + 1] = Math.random() * 15;
    positions[i3 + 2] = playerPosition.z + (Math.random() - 0.5) * 30 - 10;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  let material: THREE.PointsMaterial;
  if (weather === 'rain') {
    material = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    });
  } else {
    // snow
    material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
    });
  }

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  return particles;
}

/**
 * Update weather particles position
 */
export function updateWeatherParticles(
  particles: THREE.Points,
  weather: Weather,
  delta: number,
  playerZ: number
): void {
  const positions = particles.geometry.attributes.position.array as Float32Array;

  const speed = weather === 'rain' ? 8 : 2;

  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] -= speed * delta;

    // Reset particle to top when it reaches bottom
    if (positions[i + 1] < 0) {
      positions[i + 1] = 15;
      positions[i] = (Math.random() - 0.5) * 20;
      positions[i + 2] = playerZ + (Math.random() - 0.5) * 30 - 10;
    }

    // Gentle horizontal drift
    if (weather === 'snow') {
      positions[i] += Math.sin(Date.now() * 0.001 + i) * delta * 0.5;
    }
  }

  particles.geometry.attributes.position.needsUpdate = true;
}

/**
 * Get environment description for display
 */
export function getEnvironmentDescription(env: EnvironmentConfig): string {
  const { season, weather, timeOfDay } = env;

  const seasonNames = {
    spring: 'Spring',
    summer: 'Summer',
    fall: 'Fall',
    winter: 'Winter',
  };

  const weatherNames = {
    clear: 'Clear',
    cloudy: 'Cloudy',
    rain: 'Rainy',
    snow: 'Snowy',
  };

  const timeNames = {
    morning: 'Morning',
    day: 'Daytime',
    evening: 'Evening',
    night: 'Night',
  };

  return `${weatherNames[weather]} ${seasonNames[season]} ${timeNames[timeOfDay]}`;
}
