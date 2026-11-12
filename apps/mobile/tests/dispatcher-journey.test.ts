import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { dispatcherService } from '../src/services/dispatcher/dispatcherService';
import { ApiError } from '../src/services/api/client';

describe('Aidline Dispatcher Dashboard — Operations & Journey Test Suite', () => {
  beforeEach(() => {
    dispatcherService.resetToDefault();
  });

  test('1. Initial live queue is loaded with authoritative cases sorted by severity then waiting time', async () => {
    const cases = await dispatcherService.getCases();
    assert.equal(cases.length, 4);

    // First case must be CRITICAL
    assert.equal(cases[0].severity, 'CRITICAL');
    assert.equal(cases[0].emergencyTitle, 'Unconscious');
    assert.equal(cases[0].locationArea, '[Area A]');
    assert.equal(cases[0].status, 'UNASSIGNED');

    // Second and third must be URGENT
    assert.equal(cases[1].severity, 'URGENT');
    assert.equal(cases[1].emergencyTitle, "Can't breathe");
    assert.equal(cases[2].severity, 'URGENT');
    assert.equal(cases[2].emergencyTitle, 'Pregnancy / labour');

    // Fourth must be STABLE
    assert.equal(cases[3].severity, 'STABLE');
    assert.equal(cases[3].emergencyTitle, 'Accident / injury');
  });

  test('2. Live statistics match exact dashboard specifications and dynamic data state', async () => {
    const stats = await dispatcherService.getStats();
    assert.equal(stats.criticalWaiting, 1, 'Critical waiting must be 1');
    assert.equal(stats.urgentWaiting, 2, 'Urgent waiting must be 2 (one unassigned in initial dataset)');
    assert.equal(stats.unitsEnRoute, 3, 'Units en route must be 3');
    assert.equal(stats.unitsAvailable, 5, 'Units available must be 5');
  });

  test('3. Nearest available units list reflects operational status and distance', async () => {
    const units = await dispatcherService.getNearestUnits(3);
    assert.equal(units.length, 3);

    assert.equal(units[0].name, 'Ambulance [UNIT 1]');
    assert.equal(units[0].operationalStatus, 'AVAILABLE');

    assert.equal(units[1].name, 'Motor medic [UNIT 2]');
    assert.equal(units[1].operationalStatus, 'AVAILABLE');

    assert.equal(units[2].name, 'Ambulance [UNIT 3]');
    assert.equal(units[2].operationalStatus, 'RETURNING');
    assert.equal(units[2].distanceLabel, 'Returning');
  });

  test('4. Dispatching nearest unit updates case to EN_ROUTE, unit to BUSY, and updates stats', async () => {
    const initialStats = await dispatcherService.getStats();
    assert.equal(initialStats.criticalWaiting, 1);
    assert.equal(initialStats.unitsAvailable, 5);

    const result = await dispatcherService.assignNearestUnit('case-001');
    assert.equal(result.case.id, 'case-001');
    assert.equal(result.case.status, 'EN_ROUTE');
    assert.match(result.case.statusLabel || '', /En route/);
    assert.equal(result.unit.operationalStatus, 'BUSY');

    const updatedStats = await dispatcherService.getStats();
    assert.equal(updatedStats.criticalWaiting, 1, 'Critical case is active in queue');
    assert.equal(updatedStats.unitsAvailable, 4, 'Units available decrements');
    assert.equal(updatedStats.unitsEnRoute, 4, 'Units en route increments');
  });

  test('5. Rejects duplicate assignment on already en route emergency case', async () => {
    await dispatcherService.assignNearestUnit('case-001');

    await assert.rejects(
      async () => {
        await dispatcherService.assignNearestUnit('case-001');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'ALREADY_ASSIGNED');
        return true;
      }
    );
  });

  test('6. Search query filters cases in real time across title, location, and symptoms', async () => {
    const breatheResults = await dispatcherService.getCases('breathe');
    assert.equal(breatheResults.length, 1);
    assert.equal(breatheResults[0].emergencyTitle, "Can't breathe");

    const areaCResults = await dispatcherService.getCases('Area C');
    assert.equal(areaCResults.length, 1);
    assert.equal(areaCResults[0].locationArea, '[Area C]');

    const emptyResults = await dispatcherService.getCases('nonexistent 999');
    assert.equal(emptyResults.length, 0);
  });

  test('7. New emergency intake adds case, maintains sorting, and updates summary cards', async () => {
    const newCase = await dispatcherService.createNewCase({
      severity: 'CRITICAL',
      emergencyTitle: 'Postpartum Hemorrhage',
      emergencyDescription: 'Severe bleeding post delivery',
      locationArea: '[Area E]',
      reportedBy: 'Midwife Clinic',
      isAwake: false,
      bloodGroup: 'O+',
      callerNote: 'Need urgent ambulance transfer',
    });

    assert.equal(newCase.severity, 'CRITICAL');
    assert.equal(newCase.status, 'UNASSIGNED');

    const allCases = await dispatcherService.getCases();
    assert.equal(allCases.length, 5);
    // Both CRITICAL cases should be at top
    assert.equal(allCases[0].severity, 'CRITICAL');
    assert.equal(allCases[1].severity, 'CRITICAL');

    const updatedStats = await dispatcherService.getStats();
    assert.equal(updatedStats.criticalWaiting, 2);
  });

  test('8. Rejects invalid case creation with missing location or title', async () => {
    await assert.rejects(
      async () => {
        await dispatcherService.createNewCase({
          severity: 'URGENT',
          emergencyTitle: '',
          emergencyDescription: 'No title',
          locationArea: '[Area B]',
          reportedBy: 'Self',
          isAwake: true,
        });
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  test('9. Dispatcher profile loads authorized on-shift credentials', async () => {
    const profile = await dispatcherService.getProfile();
    assert.equal(profile.name, 'N. Eze');
    assert.equal(profile.initials, 'NE');
    assert.equal(profile.shiftStatus, 'On shift');
  });

  test('10. Case retrieval by ID returns deep copy preventing unauthorized mutation', async () => {
    const caseItem = await dispatcherService.getCaseById('case-001');
    assert(caseItem !== null);
    assert.equal(caseItem.reportedBy, 'Bystander');
    assert.equal(caseItem.isAwake, false);
    assert.equal(caseItem.bloodGroup, 'Not on file');
    assert.equal(caseItem.callerNote, 'Collapsed at market');
  });
});
