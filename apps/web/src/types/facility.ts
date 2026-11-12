/**
 * Facility Portal Types
 */

import { Facility } from './emergency';

export interface IncomingTransfer {
  emergencyId: string;
  patientName: string;
  severity: 'CRITICAL' | 'URGENT' | 'STABLE';
  chiefComplaint: string;
  responderName: string;
  vehicleType: string;
  etaMinutes: number;
  status: 'IN_TRANSIT' | 'ARRIVED' | 'HANDOVER_COMPLETED';
}

export interface FacilityDashboardData {
  facility: Facility;
  incomingTransfers: IncomingTransfer[];
  availableBeds: number;
  occupancyRate: number;
  onDutyLead: string;
}
