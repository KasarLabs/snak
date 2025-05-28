export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  type:
    | 'APPOINTMENT'
    | 'FOLLOW_UP'
    | 'MEDICATION'
    | 'TEST_RESULT'
    | 'CONSULTATION'
    | 'EMERGENCY'
    | 'ADMINISTRATIVE';
  patientId: string;
  assignedTo?: string; // Healthcare provider ID
  assignedBy?: string; // Who created/assigned the task
  centerId: string;
  dueDate?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in minutes
  tags?: string[];
  notes?: string;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  }[];
  relatedChatId?: string;
  relatedMessageId?: string;
  metadata?: {
    appointmentType?: string;
    testType?: string;
    medicationName?: string;
    dosage?: string;
    frequency?: string;
    symptoms?: string[];
    diagnosis?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskCreateRequest {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  type:
    | 'APPOINTMENT'
    | 'FOLLOW_UP'
    | 'MEDICATION'
    | 'TEST_RESULT'
    | 'CONSULTATION'
    | 'EMERGENCY'
    | 'ADMINISTRATIVE';
  patientId: string;
  assignedTo?: string;
  assignedBy?: string;
  centerId: string;
  dueDate?: Date;
  estimatedDuration?: number;
  tags?: string[];
  notes?: string;
  relatedChatId?: string;
  relatedMessageId?: string;
  metadata?: {
    appointmentType?: string;
    testType?: string;
    medicationName?: string;
    dosage?: string;
    frequency?: string;
    symptoms?: string[];
    diagnosis?: string;
  };
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  assignedTo?: string;
  dueDate?: Date;
  estimatedDuration?: number;
  tags?: string[];
  notes?: string;
  metadata?: {
    appointmentType?: string;
    testType?: string;
    medicationName?: string;
    dosage?: string;
    frequency?: string;
    symptoms?: string[];
    diagnosis?: string;
  };
}

export interface TaskSearchResult {
  tasks: Task[];
  totalCount: number;
  hasMore: boolean;
}
