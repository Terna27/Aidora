import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Platform, StatusBar, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { ResponderAuthProvider } from './src/context/ResponderAuthContext';
import { PatientNavigator } from './src/navigation/PatientNavigator';
import { ResponderNavigator } from './src/navigation/ResponderNavigator';
import { DispatcherNavigator } from './src/navigation/DispatcherNavigator';
import { colors } from './src/theme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'aidline-full-height-reset';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body, #root {
        height: 100% !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      #root {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
      }
      #root > div {
        flex: 1 1 100% !important;
        height: 100% !important;
        min-height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
      }
    `;
    document.head.appendChild(style);
  }
}

const getInitialPortal = (): 'patient' | 'responder' | 'dispatcher' => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const portalParam = params.get('portal');
      if (portalParam === 'patient' || portalParam === 'responder' || portalParam === 'dispatcher') {
        return portalParam;
      }
    } catch {
      // ignore
    }
    return 'dispatcher';
  }
  return 'patient';
};

export default function App() {
  const [activePortal, setActivePortal] = useState<'patient' | 'responder' | 'dispatcher'>(getInitialPortal);

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <AuthProvider>
        <ResponderAuthProvider>
          <View style={styles.content}>
            {activePortal === 'dispatcher' ? (
              <DispatcherNavigator
                onSwitchToPatientPortal={() => setActivePortal('patient')}
                onSwitchToResponderPortal={() => setActivePortal('responder')}
              />
            ) : activePortal === 'patient' ? (
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
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
    backgroundColor: '#0f1a2c',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    height: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
  },
});
