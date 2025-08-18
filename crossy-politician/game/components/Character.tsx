import React from 'react';
import { View } from 'react-native';

export default function Character({ size }: { size: number }) {
  const s = size * 0.8;
  return (
    <View
      style={{
        width: s, height: s,
        backgroundColor: '#f8c34a', borderRadius: 8,
        borderWidth: 2, borderColor: '#000', alignSelf: 'center',
      }}
    />
  );
}
