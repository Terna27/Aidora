import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LocationData } from '../types/emergency';
import { colors } from '../theme';

// Screens
import { WelcomeScreen } from '../screens/patient/auth/WelcomeScreen';
import { LoginScreen } from '../screens/patient/auth/LoginScreen';
import { RegisterScreen } from '../screens/patient/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/patient/auth/ForgotPasswordScreen';
import { PatientDashboardScreen } from '../screens/patient/dashboard/PatientDashboardScreen';
import { SOSConfirmationScreen } from '../screens/patient/sos/SOSConfirmationScreen';
import { LocationSelectionScreen } from '../screens/patient/sos/LocationSelectionScreen';
import { ActiveEmergencyScreen } from '../screens/patient/emergency/ActiveEmergencyScreen';
import { EmergencyHistoryScreen } from '../screens/patient/emergency/EmergencyHistoryScreen';
import { PatientProfileScreen } from '../screens/patient/profile/PatientProfileScreen';

export type PatientScreenName =
  | 'welcome'
  | 'login'
  | 'register'
  | 'forgot_password'
  | 'dashboard'
  | 'sos_confirm'
  | 'location_select'
  | 'active_emergency'
  | 'emergency_history'
  | 'profile';

interface PatientNavigatorProps {
  onSwitchToResponderPortal?: () => void;
}

export const PatientNavigator: React.FC<PatientNavigatorProps> = ({
  onSwitchToResponderPortal,
}) => {
  const { isAuthenticated, loading, activeEmergency, loginAsDemo, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<PatientScreenName>('welcome');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [locationReturnScreen, setLocationReturnScreen] = useState<PatientScreenName>('dashboard');

  // Sync screen with auth state
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        setCurrentScreen('welcome');
      } else if (activeEmergency && (currentScreen === 'dashboard' || currentScreen === 'welcome')) {
        // If user already has an active emergency, direct them to tracking status
        setCurrentScreen('active_emergency');
      }
    }
  }, [isAuthenticated, loading, activeEmergency]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.healthcare.primary} />
      </View>
    );
  }

  // Quick Demo Fast-Track from Welcome Screen
  const handleQuickDemo = async () => {
    await loginAsDemo();
    setCurrentScreen('dashboard');
  };

  switch (currentScreen) {
    case 'welcome':
      return (
        <WelcomeScreen
          onNavigateLogin={() => setCurrentScreen('login')}
          onNavigateRegister={() => setCurrentScreen('register')}
          onQuickDemoLogin={handleQuickDemo}
          onSwitchToResponderPortal={onSwitchToResponderPortal}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onBack={() => setCurrentScreen('welcome')}
          onNavigateRegister={() => setCurrentScreen('register')}
          onNavigateForgotPassword={() => setCurrentScreen('forgot_password')}
          onLoginSuccess={() => setCurrentScreen('dashboard')}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          onBack={() => setCurrentScreen('welcome')}
          onNavigateLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={() => setCurrentScreen('dashboard')}
        />
      );

    case 'forgot_password':
      return (
        <ForgotPasswordScreen
          onBack={() => setCurrentScreen('login')}
          onNavigateLogin={() => setCurrentScreen('login')}
        />
      );

    case 'dashboard':
      return (
        <PatientDashboardScreen
          onTriggerSOS={() => setCurrentScreen('sos_confirm')}
          onNavigateProfile={() => setCurrentScreen('profile')}
          onNavigateHistory={() => setCurrentScreen('emergency_history')}
          onNavigateActiveEmergency={() => setCurrentScreen('active_emergency')}
          onNavigateLocationSelect={() => {
            setLocationReturnScreen('dashboard');
            setCurrentScreen('location_select');
          }}
          onLogout={async () => {
            await logout();
            setCurrentScreen('welcome');
          }}
        />
      );

    case 'sos_confirm':
      return (
        <SOSConfirmationScreen
          selectedLocation={selectedLocation}
          onLocationUpdated={(loc) => setSelectedLocation(loc)}
          onNavigateLocationSelect={() => {
            setLocationReturnScreen('sos_confirm');
            setCurrentScreen('location_select');
          }}
          onEmergencySubmitted={() => setCurrentScreen('active_emergency')}
          onBack={() => setCurrentScreen('dashboard')}
        />
      );

    case 'location_select':
      return (
        <LocationSelectionScreen
          initialLocation={selectedLocation}
          onConfirmLocation={(loc) => {
            setSelectedLocation(loc);
            setCurrentScreen(locationReturnScreen);
          }}
          onBack={() => setCurrentScreen(locationReturnScreen)}
        />
      );

    case 'active_emergency':
      return (
        <ActiveEmergencyScreen
          onBackToDashboard={() => setCurrentScreen('dashboard')}
          onNavigateHistory={() => setCurrentScreen('emergency_history')}
        />
      );

    case 'emergency_history':
      return (
        <EmergencyHistoryScreen
          onBack={() => setCurrentScreen('dashboard')}
        />
      );

    case 'profile':
      return (
        <PatientProfileScreen
          onBack={() => setCurrentScreen('dashboard')}
        />
      );

    default:
      return (
        <PatientDashboardScreen
          onTriggerSOS={() => setCurrentScreen('sos_confirm')}
          onNavigateProfile={() => setCurrentScreen('profile')}
          onNavigateHistory={() => setCurrentScreen('emergency_history')}
          onNavigateActiveEmergency={() => setCurrentScreen('active_emergency')}
          onNavigateLocationSelect={() => setCurrentScreen('location_select')}
          onLogout={async () => {
            await logout();
            setCurrentScreen('welcome');
          }}
        />
      );
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
