import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Platform, StatusBar, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ResponderAuthProvider } from './src/context/ResponderAuthContext';
import { PatientNavigator } from './src/navigation/PatientNavigator';
import { ResponderNavigator } from './src/navigation/ResponderNavigator';
import { colors } from './src/theme';

export default function App() {
  const [activePortal, setActivePortal] = useState<'patient' | 'responder'>('patient');

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <AuthProvider>
        <ResponderAuthProvider>
          <View style={styles.content}>
            {activePortal === 'patient' ? (
              <PatientNavigator
                onSwitchToResponderPortal={() => setActivePortal('responder')}
              />
            ) : (
              <ResponderNavigator
                onSwitchToPatientPortal={() => setActivePortal('patient')}
              />
            )}
          </View>
        </ResponderAuthProvider>
      </AuthProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
});
