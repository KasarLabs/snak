export interface Chat {
  id: string;
  patientId: string;
  centerId?: string;
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  type: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PHONE' | 'IN_PERSON';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject?: string;
  summary?: string;
  tags?: string[];
  assignedTo?: string; // Healthcare provider ID
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  metadata?: {
    twilioConversationSid?: string;
    phoneNumber?: string;
    lastMessageAt?: Date;
    messageCount?: number;
  };
}

export interface ChatCreateRequest {
  patientId: string;
  centerId?: string;
  type: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PHONE' | 'IN_PERSON';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject?: string;
  assignedTo?: string;
  metadata?: {
    twilioConversationSid?: string;
    phoneNumber?: string;
  };
}

export interface ChatUpdateRequest {
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject?: string;
  summary?: string;
  tags?: string[];
  assignedTo?: string;
}

export interface ChatSearchResult {
  chats: Chat[];
  totalCount: number;
  hasMore: boolean;
}

export interface ChatCreationResult {
  id: string;
  patientId: string;
  centerId: string;
  status: string;
  type: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}
