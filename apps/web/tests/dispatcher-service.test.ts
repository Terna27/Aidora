import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { dispatcherService } from '../src/services/dispatcherService';

describe('Aidline Web — Dispatcher Service & Operational Suite', () => {
  beforeEach(() => {
    dispatcherService.resetToFixtures();
  });

  test('1. Live queue initializes with 4 authoritative cases matching screenshot', async () => {
    const cases = await dispatcherService.getCases();
    assert.strictEqual(cases.length, 4, 'Expected 4 initial cases');

    // Case 1 is Critical Unconscious Male
    assert.strictEqual(cases[0].id, 'case-001');
    assert.strictEqual(cases[0].severity, 'CRITICAL');
    assert.strictEqual(cases[0].title, 'Unconscious');
    assert.strictEqual(cases[0].location, '[Area A]');
    assert.strictEqual(cases[0].status, 'UNASSIGNED');
    assert.strictEqual(cases[0].reportedBy, 'Bystander');
    assert.strictEqual(cases[0].awake, 'No');
  });

  test('2. Dynamic stats match screenshot values (1 Critical, 2 Urgent, 3 En route, 5 Available)', () => {
    const stats = dispatcherService.getStats();
    assert.strictEqual(stats.criticalWaiting, 1, 'Critical waiting should be 1');
    assert.strictEqual(stats.urgentWaiting, 2, 'Urgent waiting should be 2');
    assert.strictEqual(stats.unitsEnRoute, 3, '3 units currently en route');
    assert.strictEqual(stats.unitsAvailable, 5, '5 units currently available');
  });

  test('3. Nearest available units return operational status and distances', () => {
    const units = dispatcherService.getNearestUnits();
    assert.strictEqual(units.length >= 3, true);

    const unit1 = units[0];
    assert.strictEqual(unit1.status, 'AVAILABLE');
    assert.match(unit1.name, /Ambulance \[UNIT 1\]/);

    const unit3 = units[2];
    assert.strictEqual(unit3.status, 'RETURNING');
    assert.strictEqual(unit3.isReturning, true);
  });

  test('4. Dispatching nearest unit assigns available vehicle and updates dynamic stats', async () => {
    const res = await dispatcherService.dispatchNearestUnit('case-001');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.case?.status, 'EN_ROUTE');
    assert.strictEqual(res.unit?.status, 'EN_ROUTE');

    // Case should now be en route
    const updatedCase = dispatcherService.getCaseById('case-001');
    assert.strictEqual(updatedCase?.status, 'EN_ROUTE');
    assert.match(updatedCase?.assignedUnitLabel || '', /En route/);

    // Stats should update: 0 critical waiting, 4 en route, 4 available
    const stats = dispatcherService.getStats();
    assert.strictEqual(stats.criticalWaiting, 0);
    assert.strictEqual(stats.unitsEnRoute, 4);
    assert.strictEqual(stats.unitsAvailable, 4);
  });

  test('5. Duplicate dispatch on already assigned or en route case is rejected', async () => {
    // case-003 is already EN_ROUTE
    const res = await dispatcherService.dispatchNearestUnit('case-003');
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /already en route/i);
  });

  test('6. Search query filters cases in real time', async () => {
    const asthmaCases = await dispatcherService.getCases('asthma');
    assert.strictEqual(asthmaCases.length, 1);
    assert.strictEqual(asthmaCases[0].id, 'case-002');

    const areaACases = await dispatcherService.getCases('[Area A]');
    assert.strictEqual(areaACases.length, 1);
    assert.strictEqual(areaACases[0].id, 'case-001');
  });

  test('7. New emergency intake adds case and maintains severity sorting', async () => {
    const res = await dispatcherService.createCase({
      severity: 'CRITICAL',
      title: 'Severe Road Traffic Crash',
      secondaryText: 'Multiple trauma injuries',
      location: 'Maitama Junction',
      reportedBy: 'Police Officer',
      awake: 'No',
      callerNote: 'High speed collision',
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.case);

    const allCases = await dispatcherService.getCases();
    assert.strictEqual(allCases.length, 5);
    // Newly created critical case should be near top
    assert.strictEqual(allCases[0].severity, 'CRITICAL');
  });

  test('8. Rejects intake with missing title or location', async () => {
    const missingTitle = await dispatcherService.createCase({
      severity: 'CRITICAL',
      title: '',
      secondaryText: 'Test',
      location: 'Test Area',
      reportedBy: 'Self',
      awake: 'Yes',
      callerNote: '',
    });
    assert.strictEqual(missingTitle.success, false);
    assert.match(missingTitle.error || '', /title is required/i);

    const missingLocation = await dispatcherService.createCase({
      severity: 'URGENT',
      title: 'Asthma attack',
      secondaryText: '',
      location: '',
      reportedBy: 'Self',
      awake: 'Yes',
      callerNote: '',
    });
    assert.strictEqual(missingLocation.success, false);
    assert.match(missingLocation.error || '', /location is required/i);
  });

  test('9. Dispatcher shift status toggles smoothly', () => {
    const initial = dispatcherService.getProfile();
    assert.strictEqual(initial.isOnShift, true);

    const updated = dispatcherService.setOnShift(false);
    assert.strictEqual(updated.isOnShift, false);
  });
});
