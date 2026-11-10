import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useResponderAuth } from '../context/ResponderAuthContext';
import { colors } from '../theme';

// Screens
import { ResponderWelcomeScreen } from '../screens/responder/auth/ResponderWelcomeScreen';
import { ResponderLoginScreen } from '../screens/responder/auth/ResponderLoginScreen';
import { ResponderRegisterScreen } from '../screens/responder/auth/ResponderRegisterScreen';
import { ResponderForgotPasswordScreen } from '../screens/responder/auth/ResponderForgotPasswordScreen';
import { ResponderDashboardScreen } from '../screens/responder/dashboard/ResponderDashboardScreen';
import { ActiveJourneyScreen } from '../screens/responder/journey/ActiveJourneyScreen';
import { ResponderProfileScreen } from '../screens/responder/profile/ResponderProfileScreen';

export type ResponderScreenName =
  | 'welcome'
  | 'login'
  | 'register'
  | 'forgot_password'
  | 'dashboard'
  | 'active_journey'
  | 'profile';

interface ResponderNavigatorProps {
  onSwitchToPatientPortal: () => void;
}

export const ResponderNavigator: React.FC<ResponderNavigatorProps> = ({
  onSwitchToPatientPortal,
}) => {
  const { isAuthenticated, loading, activeJourney, loginAsDemo, logout } = useResponderAuth();
  const [currentScreen, setCurrentScreen] = useState<ResponderScreenName>('welcome');

  // Sync screen with auth state
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        setCurrentScreen('welcome');
      } else if (activeJourney && (currentScreen === 'welcome' || currentScreen === 'login' || currentScreen === 'register')) {
        // Active journey in progress, route directly to journey monitoring
        setCurrentScreen('active_journey');
      } else if (currentScreen === 'welcome' || currentScreen === 'login' || currentScreen === 'register') {
        setCurrentScreen('dashboard');
      }
    }
  }, [isAuthenticated, loading, activeJourney]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.healthcare.primary} />
      </View>
    );
  }

  // Quick Demo Fast-Track from Welcome Screen
  const handleQuickDemo = async (responderId: string) => {
    await loginAsDemo(responderId);
    setCurrentScreen('dashboard');
  };

  switch (currentScreen) {
    case 'welcome':
      return (
        <ResponderWelcomeScreen
          onNavigateLogin={() => setCurrentScreen('login')}
          onNavigateRegister={() => setCurrentScreen('register')}
          onQuickDemoLogin={handleQuickDemo}
          onSwitchToPatientPortal={onSwitchToPatientPortal}
        />
      );

    case 'login':
      return (
        <ResponderLoginScreen
          onBack={() => setCurrentScreen('welcome')}
          onNavigateRegister={() => setCurrentScreen('register')}
          onNavigateForgotPassword={() => setCurrentScreen('forgot_password')}
          onLoginSuccess={() => setCurrentScreen('dashboard')}
        />
      );

    case 'register':
      return (
        <ResponderRegisterScreen
          onBack={() => setCurrentScreen('welcome')}
          onNavigateLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={() => setCurrentScreen('dashboard')}
        />
      );

    case 'forgot_password':
      return (
        <ResponderForgotPasswordScreen
          onBack={() => setCurrentScreen('login')}
          onNavigateLogin={() => setCurrentScreen('login')}
        />
      );

    case 'dashboard':
      return (
        <ResponderDashboardScreen
          onNavigateProfile={() => setCurrentScreen('profile')}
          onNavigateActiveJourney={() => setCurrentScreen('active_journey')}
          onSwitchToPatientPortal={onSwitchToPatientPortal}
        />
      );

    case 'active_journey':
      return (
        <ActiveJourneyScreen
          onBackToDashboard={() => setCurrentScreen('dashboard')}
        />
      );

    case 'profile':
      return (
        <ResponderProfileScreen
          onBack={() => setCurrentScreen('dashboard')}
          onLogout={async () => {
            await logout();
            setCurrentScreen('welcome');
          }}
          onSwitchToPatientPortal={onSwitchToPatientPortal}
        />
      );

    default:
      return (
        <ResponderDashboardScreen
          onNavigateProfile={() => setCurrentScreen('profile')}
          onNavigateActiveJourney={() => setCurrentScreen('active_journey')}
          onSwitchToPatientPortal={onSwitchToPatientPortal}
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
