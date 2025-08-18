import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

export default function UsernameModal({
  visible, initial, onSave, onCancel
}: {
  visible: boolean;
  initial?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial ?? '');

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#0f2033', padding: 20, borderRadius: 12, width: '85%', borderWidth: 1, borderColor: '#2d4f79' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>Enter Username</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., PlayerOne"
            placeholderTextColor="#88aacc"
            maxLength={16}
            style={{ backgroundColor: '#0d1a2b', color: '#fff', borderWidth: 1, borderColor: '#2d4f79', borderRadius: 8, padding: 12 }}
          />
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => onCancel()} style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? '#17324f' : '#0e2942', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79'
            })}>
              <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onSave(name.trim())} style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? '#1c3350' : '#11263c', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79'
            })}>
              <Text style={{ color: '#9fd5ff', textAlign: 'center', fontWeight: '700' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
