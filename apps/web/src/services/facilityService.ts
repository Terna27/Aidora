/**
 * Facility Service
 * Manages healthcare facility capacity, bed occupancy and incoming patient transfers
 */

import { Facility } from '../types/emergency';
import { FacilityDashboardData, IncomingTransfer } from '../types/facility';

const INITIAL_FACILITY: Facility = {
  id: 'fac-central',
  name: 'General Hospital Apex',
  type: 'HOSPITAL',
  address: 'Hospital Road, Central District',
  landmark: 'Near City Gate',
  totalBeds: 120,
  availableBeds: 14,
  specialties: ['Emergency & Trauma', 'Obstetrics & Neonatal', 'Critical Care ICU'],
  contactPhone: '+234 800 999 0001',
};

const INITIAL_TRANSFERS: IncomingTransfer[] = [
  {
    emergencyId: 'emg-103',
    patientName: 'Halima Sani',
    severity: 'URGENT',
    chiefComplaint: 'Pregnancy / labour (Contractions 4 min apart)',
    responderName: 'T. Adeleke',
    vehicleType: 'Ambulance [UNIT 102]',
    etaMinutes: 6,
    status: 'IN_TRANSIT',
  },
  {
    emergencyId: 'emg-104',
    patientName: 'Emeka Nwosu',
    severity: 'STABLE',
    chiefComplaint: 'Accident / injury (Fall, possible broken wrist)',
    responderName: 'B. Yusuf',
    vehicleType: 'Ambulance [UNIT 103]',
    etaMinutes: 11,
    status: 'IN_TRANSIT',
  },
];

export class FacilityService {
  private facility: Facility = { ...INITIAL_FACILITY };
  private transfers: IncomingTransfer[] = JSON.parse(JSON.stringify(INITIAL_TRANSFERS));
  private onDutyLead = 'Dr. Kelechi Okafor (Triage Lead)';
  private listeners: (() => void)[] = [];

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  public getDashboardData(): FacilityDashboardData {
    const occupancyRate = Math.round(
      ((this.facility.totalBeds - this.facility.availableBeds) / this.facility.totalBeds) * 100
    );

    return {
      facility: { ...this.facility },
      incomingTransfers: JSON.parse(JSON.stringify(this.transfers)),
      availableBeds: this.facility.availableBeds,
      occupancyRate,
      onDutyLead: this.onDutyLead,
    };
  }

  public admitTransfer(emergencyId: string): { success: boolean } {
    const idx = this.transfers.findIndex((t) => t.emergencyId === emergencyId);
    if (idx !== -1) {
      this.transfers.splice(idx, 1);
      if (this.facility.availableBeds > 0) {
        this.facility.availableBeds -= 1;
      }
      this.notify();
    }
    return { success: true };
  }

  public updateAvailableBeds(delta: number) {
    this.facility.availableBeds = Math.max(0, Math.min(this.facility.totalBeds, this.facility.availableBeds + delta));
    this.notify();
  }
}

export const facilityService = new FacilityService();
