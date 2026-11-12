import React, { useState, useEffect } from 'react';
import { DispatcherSidebar, DispatcherTab } from './DispatcherSidebar';
import { DispatcherHeader } from './DispatcherHeader';
import { DispatcherStatCards } from './DispatcherStatCards';
import { EmergencyQueueTable } from './EmergencyQueueTable';
import { SelectedCaseCard } from './SelectedCaseCard';
import { NearestUnitsCard } from './NearestUnitsCard';
import { NewCaseModal } from './NewCaseModal';
import { DispatcherMapView } from './DispatcherMapView';
import { DispatcherUnitsView } from './DispatcherUnitsView';
import { DispatcherHistoryView } from './DispatcherHistoryView';
import { dispatcherService } from '../../services/dispatcherService';
import { DispatcherCase, DispatcherUnit, DispatcherStats, DispatcherProfile, CaseIntakePayload } from '../../types/dispatcher';

export const DispatcherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DispatcherTab>('live-queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [cases, setCases] = useState<DispatcherCase[]>(() => dispatcherService.getCasesSync());
  const [units, setUnits] = useState<DispatcherUnit[]>(() => dispatcherService.getNearestUnits());
  const [stats, setStats] = useState<DispatcherStats>(() => dispatcherService.getStats());
  const [profile, setProfile] = useState<DispatcherProfile>(() => dispatcherService.getProfile());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    const initial = dispatcherService.getCasesSync();
    return initial.length > 0 ? initial[0].id : null;
  });
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Sync state from service
  const refreshState = async () => {
    const caseList = await dispatcherService.getCases(searchQuery);
    setCases(caseList);
    setUnits(dispatcherService.getNearestUnits());
    setStats(dispatcherService.getStats());
    setProfile(dispatcherService.getProfile());

    // Auto-select first case if none selected
    if (!selectedCaseId && caseList.length > 0) {
      setSelectedCaseId(caseList[0].id);
    } else if (selectedCaseId && !caseList.some((c) => c.id === selectedCaseId) && caseList.length > 0) {
      setSelectedCaseId(caseList[0].id);
    }
  };

  useEffect(() => {
    refreshState();
    const unsubscribe = dispatcherService.subscribe(() => {
      refreshState();
    });
    return () => {
      unsubscribe();
    };
  }, [searchQuery]);

  const handleSelectCase = (c: DispatcherCase) => {
    setSelectedCaseId(c.id);
  };

  const handleDispatch = async (caseId: string) => {
    setIsDispatching(true);
    await dispatcherService.dispatchNearestUnit(caseId);
    setIsDispatching(false);
    refreshState();
  };

  const handleAssignUnitFromTable = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCaseId(caseId);
    handleDispatch(caseId);
  };

  const handleCreateCase = async (payload: CaseIntakePayload) => {
    const res = await dispatcherService.createCase(payload);
    if (res.success && res.case) {
      setSelectedCaseId(res.case.id);
      refreshState();
    }
    return res;
  };

  const handleToggleShift = () => {
    dispatcherService.setOnShift(!profile.isOnShift);
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || null;
  const pendingCasesCount = cases.length;

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        minHeight: 'calc(100vh - 42px)',
        backgroundColor: '#f6f7fb',
      }}
    >
      {/* 1. Left Sidebar */}
      <DispatcherSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCasesCount}
        profile={profile}
        onToggleShift={handleToggleShift}
      />

      {/* 2. Main Workspace */}
      <main
        style={{
          flex: 1,
          padding: '24px 24px 32px 24px',
          boxSizing: 'border-box',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '1280px',
        }}
      >
        {activeTab === 'live-queue' && (
          <>
            {/* Header */}
            <DispatcherHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onNewCaseClick={() => setIsNewCaseOpen(true)}
            />

            {/* 4 Summary Stat Cards */}
            <DispatcherStatCards stats={stats} />

            {/* 2-Column Content Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(480px, 1fr) 323px',
                gap: '18px',
                alignItems: 'start',
                width: '100%',
              }}
            >
              {/* Left Column: Emergency Queue Table */}
              <div style={{ minWidth: 0 }}>
                <EmergencyQueueTable
                  cases={cases}
                  selectedCaseId={selectedCase?.id || null}
                  onSelectCase={handleSelectCase}
                  onAssignUnit={handleAssignUnitFromTable}
                />
              </div>

              {/* Right Column: Selected Case & Nearest Units */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '323px' }}>
                <SelectedCaseCard
                  selectedCase={selectedCase}
                  onDispatch={handleDispatch}
                  isDispatching={isDispatching}
                />
                <NearestUnitsCard units={units} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'map' && (
          <DispatcherMapView
            cases={cases}
            units={units}
            onSelectCase={(c) => {
              setSelectedCaseId(c.id);
              setActiveTab('live-queue');
            }}
          />
        )}

        {activeTab === 'units' && <DispatcherUnitsView units={units} />}

        {activeTab === 'history' && <DispatcherHistoryView />}
      </main>

      {/* New Case Intake Modal */}
      <NewCaseModal
        isOpen={isNewCaseOpen}
        onClose={() => setIsNewCaseOpen(false)}
        onSubmit={handleCreateCase}
      />
    </div>
  );
};
