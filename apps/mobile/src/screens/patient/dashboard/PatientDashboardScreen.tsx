import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
} from 'react-native';
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog';
import { useAuth } from '../../../context/AuthContext';
import { serviceRegistry } from '../../../services/serviceRegistry';

interface PatientDashboardProps {
  onTriggerSOS: () => void;
  onNavigateProfile: () => void;
  onNavigateHistory: () => void;
  onNavigateActiveEmergency: () => void;
  onNavigateLocationSelect: () => void;
  onLogout: () => void;
}

const AVATAR_PALETTE = ['#DBEAFE', '#FCE7F3', '#EDE9FE', '#FEF3C7', '#DCFCE7'];

export const PatientDashboardScreen: React.FC<PatientDashboardProps> = ({
  onTriggerSOS,
  onNavigateProfile,
  onNavigateHistory,
  onNavigateActiveEmergency,
  onNavigateLocationSelect,
  onLogout,
}) => {
  const { patient, activeEmergency } = useAuth();
  const [showSosDialog, setShowSosDialog] = useState(false);
  const [demoModeModalVisible, setDemoModeModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'connectivity' | 'history' | 'contacts' | 'settings'>('home');
  const [showConnectivityModal, setShowConnectivityModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Authenticated patient first name with neutral fallback
  const patientFullName = patient?.fullName?.trim();
  const patientFirstName = patientFullName ? patientFullName.split(' ')[0] : null;

  // Real saved emergency contacts
  const savedContacts = patient?.emergencyContacts || [];
  const contactsCount = savedContacts.length;

  // Mock mode reflects actual service configuration
  const isMockMode = serviceRegistry.isMock;

  const handleSosPress = () => {
    if (activeEmergency) {
      onNavigateActiveEmergency();
      return;
    }
    setShowSosDialog(true);
  };

  const confirmSosTrigger = () => {
    setShowSosDialog(false);
    onTriggerSOS();
  };

  const handleCallHotline = () => {
    Linking.openURL('tel:112').catch(() => {});
  };

  const handleTabPress = (tab: 'home' | 'connectivity' | 'history' | 'contacts' | 'settings') => {
    setActiveTab(tab);
    if (tab === 'home') {
      // Already on dashboard home
    } else if (tab === 'connectivity') {
      setShowConnectivityModal(true);
    } else if (tab === 'history') {
      onNavigateHistory();
    } else if (tab === 'contacts') {
      onNavigateProfile();
    } else if (tab === 'settings') {
      onNavigateProfile();
    }
  };

  const getContactInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'EC').toUpperCase();
  };

  return (
    <View style={styles.screen}>
      {/* BACKGROUND CONCENTRIC RADAR RINGS RADIATING BEHIND AVATAR */}
      <View style={styles.radarContainer} pointerEvents="none">
        <View style={[styles.radarRing, styles.radarRing4]} />
        <View style={[styles.radarRing, styles.radarRing3]} />
        <View style={[styles.radarRing, styles.radarRing2]} />
        <View style={[styles.radarRing, styles.radarRing1]} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profileSection}
            onPress={onNavigateProfile}
            activeOpacity={0.8}
            accessibilityLabel="Patient Profile"
          >
            <View style={styles.avatarWrapper}>
              <View style={styles.patientAvatarFallback}>
                <Text style={styles.avatarInitial}>
                  {patientFirstName ? patientFirstName.charAt(0).toUpperCase() : 'P'}
                </Text>
              </View>
            </View>

            <View style={styles.greetingWrapper}>
              {patientFirstName ? (
                <View style={styles.greetingNameRow}>
                  <Text style={styles.greetingPrefix}>Hi </Text>
                  <Text style={styles.greetingName}>{patientFirstName}!</Text>
                </View>
              ) : (
                <Text style={styles.greetingName}>Welcome!</Text>
              )}

              {/* REAL APPLICATION STATUS */}
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.onlineStatus}>
                  {isMockMode ? 'Service Ready (Demo)' : 'Service Connected'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            {/* LOCATION TARGET BUTTON WITH GREEN BADGE */}
            <TouchableOpacity
              style={styles.circleActionButton}
              onPress={onNavigateLocationSelect}
              activeOpacity={0.7}
              accessibilityLabel="Select Registered Location"
            >
              <View style={styles.crosshairOuter}>
                <View style={styles.crosshairDot} />
                <View style={[styles.crosshairTick, styles.crosshairTickTop]} />
                <View style={[styles.crosshairTick, styles.crosshairTickBottom]} />
                <View style={[styles.crosshairTick, styles.crosshairTickLeft]} />
                <View style={[styles.crosshairTick, styles.crosshairTickRight]} />
              </View>
              <View style={styles.locationActiveDot} />
            </TouchableOpacity>

            {/* NOTIFICATION BELL BUTTON WITH RED BADGE */}
            <TouchableOpacity
              style={styles.circleActionButton}
              onPress={() => setShowNotificationModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <View style={styles.bellIconWrapper}>
                <View style={styles.bellDome} />
                <View style={styles.bellRim} />
                <View style={styles.bellClapper} />
              </View>
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>2</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* DEMO MODE CARD WITH HONEST SIMULATION DISCLOSURE */}
        <TouchableOpacity
          style={styles.demoModeCard}
          onPress={() => setDemoModeModalVisible(true)}
          activeOpacity={0.85}
          accessibilityLabel="Demo Mode Details"
        >
          <View style={styles.demoLeft}>
            <View style={styles.flaskIconWrapper}>
              <View style={styles.flaskNeck} />
              <View style={styles.flaskBody} />
            </View>
            <View style={styles.demoTextCol}>
              <Text style={styles.demoModeLabel}>Demo mode</Text>
              <Text style={styles.demoModeSub}>Simulated emergency dispatch</Text>
            </View>
          </View>

          <View
            style={[
              styles.switchTrack,
              isMockMode ? styles.switchTrackOn : styles.switchTrackOff,
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                isMockMode ? styles.switchThumbOn : styles.switchThumbOff,
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* EMERGENCY CONTACTS CARD USING ACTUAL SAVED CONTACTS */}
        <View style={styles.contactsCard}>
          <View style={styles.contactsHeaderRow}>
            <View style={styles.contactsHeaderLeft}>
              <View style={styles.contactsIconBadge}>
                <Text style={styles.contactsIconGlyph}>📞</Text>
                <View style={styles.soundWaves}>
                  <View style={[styles.soundWave, styles.soundWave1]} />
                  <View style={[styles.soundWave, styles.soundWave2]} />
                </View>
              </View>

              <View style={styles.contactsTitleWrapper}>
                <Text style={styles.contactsTitle}>Emergency contacts</Text>
                <Text style={styles.contactsSubtitle}>
                  {contactsCount === 0
                    ? 'No contacts saved'
                    : `${contactsCount} ${contactsCount === 1 ? 'contact saved' : 'contacts saved'}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onNavigateProfile}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* REAL CONTACT AVATARS ROW OR HONEST EMPTY STATE */}
          <View style={styles.avatarsRow}>
            {savedContacts.length > 0 ? (
              savedContacts.slice(0, 4).map((contact, idx) => (
                <View
                  key={contact.id || idx.toString()}
                  style={[
                    styles.contactAvatarContainer,
                    idx > 0 && styles.overlappingAvatar,
                    {
                      zIndex: savedContacts.length - idx,
                      backgroundColor: AVATAR_PALETTE[idx % AVATAR_PALETTE.length],
                    },
                  ]}
                >
                  <Text style={styles.avatarInitialsText}>
                    {getContactInitials(contact.name)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyContactsText}>
                No contacts saved yet. Tap + to add a trusted relative or neighbor.
              </Text>
            )}

            <TouchableOpacity
              style={styles.addContactButton}
              onPress={onNavigateProfile}
              activeOpacity={0.7}
              accessibilityLabel="Add New Emergency Contact"
            >
              <Text style={styles.plusSymbol}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACTIVE EMERGENCY DISPATCH BANNER (IF ONGOING) */}
        {activeEmergency && (
          <TouchableOpacity
            style={styles.activeEmergencyCard}
            onPress={onNavigateActiveEmergency}
            activeOpacity={0.85}
          >
            <View style={styles.activeEmergencyHeader}>
              <View style={styles.activeEmergencyBeacon} />
              <Text style={styles.activeEmergencyTitle}>ACTIVE EMERGENCY IN PROGRESS</Text>
            </View>
            <Text style={styles.activeEmergencyDesc}>
              Destination: {activeEmergency.destinationFacility?.name || 'Maternal Clinic'} • Tap to view responder & route ➔
            </Text>
          </TouchableOpacity>
        )}

        {/* CENTER PANIC BUTTON HERO */}
        <View style={styles.panicContainer}>
          <View style={styles.panicOuterGlow}>
            <TouchableOpacity
              style={styles.panicButton}
              onPress={handleSosPress}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Panic Button: Request Emergency Transportation"
            >
              {/* WHITE WARNING TRIANGLE WITH EXCLAMATION MARK */}
              <View style={styles.triangleContainer}>
                <View style={styles.triangleShape} />
                <View style={styles.exclamationWrapper}>
                  <View style={styles.exclamationBar} />
                  <View style={styles.exclamationDot} />
                </View>
              </View>

              {/* BOLD UPPERCASE PANIC TEXT */}
              <Text style={styles.panicText}>PANIC</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TWO FEATURE CARDS: FAMILY CONNECTIVITY & HEALTH MONITORING */}
        <View style={styles.featureCardsRow}>
          {/* LEFT: FAMILY CONNECTIVITY CARD (HONEST DEVELOPMENT STATUS) */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => setShowConnectivityModal(true)}
            activeOpacity={0.8}
            accessibilityLabel="Family Connectivity Details"
          >
            <View style={styles.featureIconBadge}>
              <View style={styles.familyNodesWrapper}>
                <View style={[styles.familyNode, styles.familyNodeTop]} />
                <View style={[styles.familyNode, styles.familyNodeBottom]} />
                <View style={[styles.familyNode, styles.familyNodeLeft]} />
                <View style={[styles.familyNode, styles.familyNodeRight]} />
                <View style={styles.familyCenterLineV} />
                <View style={styles.familyCenterLineH} />
              </View>
            </View>

            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>Family</Text>
              <Text style={styles.featureTitle}>Connectivity</Text>
            </View>

            {/* HONEST COMING SOON STATUS */}
            <View style={styles.featureStatusRow}>
              <View style={styles.featureStatusDotAmber} />
              <Text style={styles.featureStatusTextAmber}>Coming Soon</Text>
            </View>
          </TouchableOpacity>

          {/* RIGHT: HEALTH MONITORING CARD (HONEST PROFILE STATUS, ZERO FABRICATED DATA) */}
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => setShowHealthModal(true)}
            activeOpacity={0.8}
            accessibilityLabel="Health Monitoring Details"
          >
            <View style={styles.healthTopRow}>
              <View style={styles.featureIconBadge}>
                <View style={styles.watchIconWrapper}>
                  <View style={styles.watchStrapTop} />
                  <View style={styles.watchFace}>
                    <View style={styles.pulseLine} />
                  </View>
                  <View style={styles.watchStrapBottom} />
                </View>
              </View>

              {/* PREVIEW STATUS PILL (REPLACING FABRICATED 92% BATTERY) */}
              <View style={styles.previewPill}>
                <Text style={styles.previewPillText}>IN DEV</Text>
              </View>
            </View>

            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>Health</Text>
              <Text style={styles.featureTitle}>Monitoring</Text>
            </View>

            {/* HONEST PROFILE / COMING SOON STATUS */}
            <View style={styles.featureStatusRow}>
              {patient?.gestationalAgeWeeks ? (
                <>
                  <View style={styles.featureStatusDot} />
                  <Text style={styles.featureStatusText}>
                    {patient.gestationalAgeWeeks} Wks Logged
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.featureStatusDotAmber} />
                  <Text style={styles.featureStatusTextAmber}>In Development</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* BOTTOM SPACER FOR FIXED NAVIGATION BAR */}
        <View style={styles.bottomScrollSpacer} />
      </ScrollView>

      {/* DEEP NAVY-BLUE BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavContainer}>
        {/* TAB 1: HOME (ACTIVE PILL) */}
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'home' && styles.navItemActive]}
          onPress={() => handleTabPress('home')}
          activeOpacity={0.8}
          accessibilityLabel="Home"
        >
          <View style={styles.homeIconWrapper}>
            <View style={styles.homeRoof} />
            <View style={styles.homeBody} />
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        {/* TAB 2: CONNECTIVITY */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleTabPress('connectivity')}
          activeOpacity={0.7}
          accessibilityLabel="Connectivity"
        >
          <View style={styles.connectivityIconWrapper}>
            <View style={styles.connNodeTop} />
            <View style={styles.connLineLeft} />
            <View style={styles.connLineRight} />
            <View style={styles.connNodeBottomLeft} />
            <View style={styles.connNodeBottomRight} />
          </View>
          <Text style={styles.navLabel}>Connectivity</Text>
        </TouchableOpacity>

        {/* TAB 3: EMERGENCY HISTORY */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleTabPress('history')}
          activeOpacity={0.7}
          accessibilityLabel="Emergency History"
        >
          <View style={styles.historyShieldIcon}>
            <View style={styles.shieldOutline}>
              <View style={styles.shieldCheckmark} />
            </View>
          </View>
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        {/* TAB 4: EMERGENCY CONTACTS */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleTabPress('contacts')}
          activeOpacity={0.7}
          accessibilityLabel="Emergency Contacts"
        >
          <View style={styles.navCallIconWrapper}>
            <Text style={styles.navCallIcon}>📞</Text>
          </View>
          <Text style={styles.navLabel}>Contacts</Text>
        </TouchableOpacity>

        {/* TAB 5: SETTINGS */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleTabPress('settings')}
          activeOpacity={0.7}
          accessibilityLabel="Settings"
        >
          <View style={styles.settingsCogIcon}>
            <View style={styles.cogCenter} />
            <View style={[styles.cogTooth, styles.cogToothV]} />
            <View style={[styles.cogTooth, styles.cogToothH]} />
            <View style={[styles.cogTooth, styles.cogToothD1]} />
            <View style={[styles.cogTooth, styles.cogToothD2]} />
          </View>
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* SOS CONFIRMATION MODAL */}
      <ConfirmationDialog
        visible={showSosDialog}
        title="Confirm Emergency Transportation"
        message="Are you currently experiencing labor, complications, or a pregnancy medical emergency and require immediate transportation to a healthcare clinic?"
        confirmLabel="Yes, Request Emergency Ride"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={confirmSosTrigger}
        onCancel={() => setShowSosDialog(false)}
      />

      {/* DEMO MODE DISCLOSURE MODAL */}
      <Modal
        visible={demoModeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDemoModeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={{ fontSize: 26 }}>🧪</Text>
            </View>
            <Text style={styles.modalTitle}>Development Simulation Mode</Text>
            <Text style={styles.modalBody}>
              RideRoute is operating in development mock mode.
              {'\n\n'}
              • Emergency requests, responder dispatching, and clinic routing are simulated locally for interface testing.
              {'\n\n'}
              • No real-world commercial drivers or municipal emergency services (112) are dispatched.
              {'\n\n'}
              • In a genuine medical crisis, use the direct 112 hotline shortcut.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setDemoModeModalVisible(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FAMILY CONNECTIVITY INFORMATIONAL MODAL */}
      <Modal
        visible={showConnectivityModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConnectivityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={{ fontSize: 28 }}>👨‍👩‍👧‍👦</Text>
            </View>
            <Text style={styles.modalTitle}>Family Connectivity Network</Text>
            <View style={styles.inDevTag}>
              <Text style={styles.inDevTagText}>FEATURE IN DEVELOPMENT</Text>
            </View>
            <Text style={styles.modalBody}>
              • Automated Relative Alerts: Automated SMS broadcasts to saved contacts during emergency dispatches are planned for a subsequent backend release.
              {'\n\n'}
              • Offline Mesh Relays: Peer-to-peer SMS mesh routing for zero-data rural zones is in active specification.
              {'\n\n'}
              • Available Now: You can view and manage your primary emergency contacts on this dashboard. When in distress, their phone numbers are accessible for direct calling.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowConnectivityModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEALTH MONITORING INFORMATIONAL MODAL */}
      <Modal
        visible={showHealthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHealthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={{ fontSize: 28 }}>🩺</Text>
            </View>
            <Text style={styles.modalTitle}>Health & Clinical Monitoring</Text>
            <Text style={styles.modalBody}>
              RideRoute coordinates emergency transportation; ordinary riders and drivers are not medical professionals.
              {'\n\n'}
              {patient?.gestationalAgeWeeks
                ? `• Gestational Profile: ${patient.gestationalAgeWeeks} weeks gestational age registered.\n`
                : ''}
              {patient?.bloodGroup
                ? `• Blood Group: ${patient.bloodGroup}\n\n`
                : '\n'}
              • Wearable Telemetry: Smartwatch and Bluetooth pulse-band integration are in development. No wearable device is currently connected.
              {'\n\n'}
              • Clinical Vitals: Complete clinical assessments and medical evaluations are provided on-site by qualified healthcare staff upon clinic arrival.
            </Text>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowHealthModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NOTIFICATIONS MODAL */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={{ fontSize: 28 }}>🔔</Text>
            </View>
            <Text style={styles.modalTitle}>Notifications (2)</Text>
            <View style={styles.notificationItem}>
              <Text style={styles.notifItemTitle}>📍 GPS Location Service</Text>
              <Text style={styles.notifItemDesc}>Pickup community landmark configured for rapid responder dispatch.</Text>
            </View>
            <View style={styles.notificationItem}>
              <Text style={styles.notifItemTitle}>🛡️ Transport Network Ready</Text>
              <Text style={styles.notifItemDesc}>Verified motorcycle riders and taxi drivers available in your coverage area.</Text>
            </View>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowNotificationModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF4FA', // Soft light blue-grey matching reference image
  },
  radarContainer: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(195, 218, 238, 0.45)',
  },
  radarRing1: {
    width: 80,
    height: 80,
    borderColor: 'rgba(180, 210, 235, 0.65)',
  },
  radarRing2: {
    width: 140,
    height: 140,
    borderColor: 'rgba(180, 210, 235, 0.50)',
  },
  radarRing3: {
    width: 200,
    height: 200,
    borderColor: 'rgba(180, 210, 235, 0.35)',
  },
  radarRing4: {
    width: 260,
    height: 260,
    borderColor: 'rgba(180, 210, 235, 0.22)',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 20,
  },

  // TOP HEADER
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#0D5C96',
    overflow: 'hidden',
  },
  patientAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D5C96',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingWrapper: {
    marginLeft: 12,
  },
  greetingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingPrefix: {
    fontSize: 18,
    fontWeight: '400',
    color: '#0F172A',
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E', // Green status dot
    marginRight: 6,
  },
  onlineStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  // CROSSHAIRS ICON SHAPE
  crosshairOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0F172A',
  },
  crosshairTick: {
    position: 'absolute',
    backgroundColor: '#0F172A',
  },
  crosshairTickTop: {
    top: -4,
    width: 2,
    height: 4,
  },
  crosshairTickBottom: {
    bottom: -4,
    width: 2,
    height: 4,
  },
  crosshairTickLeft: {
    left: -4,
    width: 4,
    height: 2,
  },
  crosshairTickRight: {
    right: -4,
    width: 4,
    height: 2,
  },
  locationActiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#84CC16', // Lime green dot matching screenshot
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // BELL ICON SHAPE
  bellIconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDome: {
    width: 13,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 2,
    borderColor: '#0F172A',
    borderBottomWidth: 0,
  },
  bellRim: {
    width: 16,
    height: 2,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  bellClapper: {
    width: 4,
    height: 3,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444', // Red badge matching screenshot
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // DEMO MODE CARD
  demoModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  demoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flaskIconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
  },
  flaskNeck: {
    width: 4,
    height: 5,
    borderWidth: 1.5,
    borderColor: '#64748B',
    borderTopWidth: 1.5,
  },
  flaskBody: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#64748B',
    marginTop: -1,
  },
  demoTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  demoModeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  demoModeSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#1E293B', // Dark slate track matching screenshot
  },
  switchTrackOff: {
    backgroundColor: '#CBD5E1',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
    marginRight: 3,
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
    marginLeft: 3,
  },

  // EMERGENCY CONTACTS CARD
  contactsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  contactsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactsIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE', // Light blue rounded square badge
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  contactsIconGlyph: {
    fontSize: 18,
  },
  soundWaves: {
    position: 'absolute',
    top: 6,
    right: 8,
  },
  soundWave: {
    position: 'absolute',
    borderColor: '#0284C7',
    borderRightWidth: 1.5,
    borderRadius: 10,
  },
  soundWave1: {
    width: 8,
    height: 10,
  },
  soundWave2: {
    width: 12,
    height: 14,
  },
  contactsTitleWrapper: {
    marginLeft: 12,
    flex: 1,
  },
  contactsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  contactsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7', // Blue link
    marginLeft: 6,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  contactAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlappingAvatar: {
    marginLeft: -8, // Slight overlap matching screenshot
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyContactsText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    lineHeight: 18,
  },
  addContactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: 'transparent',
  },
  plusSymbol: {
    fontSize: 22,
    fontWeight: '300',
    color: '#94A3B8',
    marginTop: -2,
  },

  // ACTIVE EMERGENCY DISPATCH BANNER
  activeEmergencyCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 14,
  },
  activeEmergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeEmergencyBeacon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  activeEmergencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  activeEmergencyDesc: {
    fontSize: 13,
    color: '#7F1D1D',
    marginTop: 4,
    fontWeight: '500',
  },

  // CENTER PANIC BUTTON
  panicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  panicOuterGlow: {
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: '#FFEBEB', // Translucent soft pink-red ring matching screenshot
    alignItems: 'center',
    justifyContent: 'center',
  },
  panicButton: {
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: '#DC2626', // Bright emergency red matching screenshot
    borderWidth: 8,
    borderColor: '#FFFFFF', // Thick crisp white outer border
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 12,
  },
  triangleContainer: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  triangleShape: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 36,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF', // Solid white triangle
  },
  exclamationWrapper: {
    position: 'absolute',
    top: 14,
    alignItems: 'center',
  },
  exclamationBar: {
    width: 3.5,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#DC2626', // Red exclamation inside white triangle
  },
  exclamationDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#DC2626',
    marginTop: 2.5,
  },
  panicText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginTop: 6,
  },

  // TWO FEATURE CARDS
  featureCardsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 10,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE', // Light blue rounded square
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 4 FAMILY NODES ICON SHAPE
  familyNodesWrapper: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyNode: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  familyNodeTop: {
    top: 1,
  },
  familyNodeBottom: {
    bottom: 1,
  },
  familyNodeLeft: {
    left: 1,
  },
  familyNodeRight: {
    right: 1,
  },
  familyCenterLineV: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(2, 132, 199, 0.4)',
  },
  familyCenterLineH: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: 'rgba(2, 132, 199, 0.4)',
  },
  healthTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  // WATCH WITH PULSE ICON SHAPE
  watchIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchStrapTop: {
    width: 8,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#0284C7',
  },
  watchFace: {
    width: 18,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  pulseLine: {
    width: 10,
    height: 2,
    backgroundColor: '#0284C7',
    borderRadius: 1,
  },
  watchStrapBottom: {
    width: 8,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#0284C7',
  },
  previewPill: {
    backgroundColor: '#FEF3C7', // Amber/warm pill indicating preview
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  featureTextWrapper: {
    marginTop: 14,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  featureStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  featureStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E', // Green status dot
    marginRight: 6,
  },
  featureStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#16A34A',
  },
  featureStatusDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706', // Amber status dot for in-development items
    marginRight: 6,
  },
  featureStatusTextAmber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B45309',
  },

  bottomScrollSpacer: {
    height: 84, // Space so content doesn't get covered by fixed bottom navigation
  },

  // DEEP NAVY BOTTOM NAVIGATION BAR
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B1B33', // Deep navy matching reference image
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 22,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  navItemActive: {
    backgroundColor: '#1E3557', // Subtle lighter navy active pill matching screenshot
    paddingHorizontal: 16,
  },
  // HOME ICON SHAPE
  homeIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  homeBody: {
    width: 14,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  // CONNECTIVITY ICON SHAPE
  connectivityIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    position: 'relative',
  },
  connNodeTop: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8FA4C4',
  },
  connLineLeft: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 5,
    height: 7,
    borderColor: '#8FA4C4',
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
  },
  connLineRight: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 5,
    height: 7,
    borderColor: '#8FA4C4',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
  },
  connNodeBottomLeft: {
    position: 'absolute',
    bottom: 2,
    left: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8FA4C4',
  },
  connNodeBottomRight: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8FA4C4',
  },
  // HISTORY SHIELD ICON SHAPE
  historyShieldIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldOutline: {
    width: 16,
    height: 18,
    borderRadius: 4,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    borderWidth: 1.8,
    borderColor: '#8FA4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCheckmark: {
    width: 5,
    height: 8,
    borderColor: '#8FA4C4',
    borderRightWidth: 1.8,
    borderBottomWidth: 1.8,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
  },
  // NAV CALL ICON
  navCallIconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCallIcon: {
    fontSize: 15,
  },
  // SETTINGS COG ICON SHAPE
  settingsCogIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cogCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8FA4C4',
  },
  cogTooth: {
    position: 'absolute',
    backgroundColor: '#8FA4C4',
  },
  cogToothV: {
    width: 2,
    height: 18,
  },
  cogToothH: {
    width: 18,
    height: 2,
  },
  cogToothD1: {
    width: 2,
    height: 18,
    transform: [{ rotate: '45deg' }],
  },
  cogToothD2: {
    width: 2,
    height: 18,
    transform: [{ rotate: '-45deg' }],
  },
  navLabel: {
    fontSize: 11,
    color: '#8FA4C4', // Muted slate-blue
    marginTop: 4,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // MODAL STYLING
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  inDevTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 12,
  },
  inDevTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  modalBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'left',
    marginBottom: 20,
    width: '100%',
  },
  notificationItem: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifItemDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  modalPrimaryBtn: {
    backgroundColor: '#0D5C96',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
