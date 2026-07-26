import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SmokeTestSchema } from '@logistics/shared';

export default function App() {
  const testData = SmokeTestSchema.safeParse({ status: 'mobile-ok', timestamp: Date.now() });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logistics Mobile App</Text>
      <Text>Shared validation status: {testData.success ? 'VALID' : 'INVALID'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
