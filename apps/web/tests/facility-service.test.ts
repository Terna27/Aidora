import { test, describe } from 'node:test';
import assert from 'node:assert';
import { facilityService } from '../src/services/facilityService';

describe('Aidline Web — Facility Service Suite', () => {
  test('1. Facility dashboard data reports beds and incoming transfers', () => {
    const data = facilityService.getDashboardData();
    assert.strictEqual(data.facility.name, 'General Hospital Apex');
    assert.strictEqual(data.availableBeds, 14);
    assert.strictEqual(data.facility.totalBeds, 120);
    assert.strictEqual(data.incomingTransfers.length, 2);
  });

  test('2. Admitting an incoming emergency transfer decrements available beds', () => {
    const initialBeds = facilityService.getDashboardData().availableBeds;
    const res = facilityService.admitTransfer('emg-103');
    assert.strictEqual(res.success, true);

    const updated = facilityService.getDashboardData();
    assert.strictEqual(updated.availableBeds, initialBeds - 1);
    assert.strictEqual(updated.incomingTransfers.length, 1);
  });

  test('3. Manually adjusting available beds stays within limits', () => {
    facilityService.updateAvailableBeds(5);
    const data = facilityService.getDashboardData();
    assert.ok(data.availableBeds <= data.facility.totalBeds);
  });
});
