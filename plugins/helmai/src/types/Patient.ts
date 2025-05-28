export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  ssn?: string; // For Desmos integration
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  emergencyContact?: {
    name: string;
    phoneNumber: string;
    relationship: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientSearchResult {
  patients: Patient[];
  totalCount: number;
  hasMore: boolean;
}

export interface PatientCreateRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  ssn?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}
