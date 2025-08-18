import React from 'react';
import { View } from 'react-native';
import { TILE_BG_GRASS, TILE_BG_ROAD } from '../constants';

export default function Tile({ laneType, size }: { laneType: 'grass' | 'road'; size: number }) {
  return (
    <View
      style={{
        width: '100%', height: size,
        backgroundColor: laneType === 'grass' ? TILE_BG_GRASS : TILE_BG_ROAD,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
      }}
    />
  );
}
