import React from 'react';
import { View } from 'react-native';

export default function Car({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size * 0.9, height: size * 0.6,
        backgroundColor: '#e24b4b', borderRadius: 6,
        borderWidth: 2, borderColor: '#000',
      }}
    />
  );
}
