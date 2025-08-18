import React from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

export default function LeaderboardModal({
  visible, onClose, title, items, footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: { username?: string; score: number; date?: string; created_at?: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ backgroundColor: '#0f2033', padding: 20, borderRadius: 12, width: '88%', borderWidth: 1, borderColor: '#2d4f79' }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(_, idx) => String(idx)}
            renderItem={({ item, index }) => (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#cfe8ff' }}>#{index + 1}</Text>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{item.username ?? '—'}</Text>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{item.score}</Text>
                <Text style={{ color: '#82b3e6' }}>{item.date ? new Date(item.date).toLocaleDateString() : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '')}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: '#82b3e6', textAlign: 'center', marginVertical: 10 }}>No scores yet — be the first!</Text>}
            style={{ maxHeight: 320, marginBottom: 16 }}
          />
          {footer}
          <Pressable onPress={onClose} style={({ pressed }) => ({
            backgroundColor: pressed ? '#1c3350' : '#11263c',
            paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2d4f79', marginTop: 12
          })}>
            <Text style={{ color: '#9fd5ff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
