export interface Message {
  id: string;
  chatId: string;
  content: string;
  senderType: 'PATIENT' | 'USER' | 'ASSISTANT' | 'SYSTEM';
  senderId: string;
  senderName?: string;
  messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  timestamp: Date;
  editedAt?: Date;
  metadata?: {
    twilioMessageSid?: string;
    twilioAccountSid?: string;
    twilioFrom?: string;
    twilioTo?: string;
    mediaUrl?: string;
    mediaType?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    replyToMessageId?: string;
    isForwarded?: boolean;
    deliveryStatus?: string;
  };
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  }[];
}

export interface MessageCreateRequest {
  chatId: string;
  content: string;
  senderType: 'PATIENT' | 'USER' | 'ASSISTANT' | 'SYSTEM';
  senderId: string;
  senderName?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  metadata?: {
    twilioMessageSid?: string;
    twilioAccountSid?: string;
    twilioFrom?: string;
    twilioTo?: string;
    mediaUrl?: string;
    mediaType?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    replyToMessageId?: string;
  };
}

export interface MessageSearchResult {
  messages: Message[];
  totalCount: number;
  hasMore: boolean;
}

export interface MessageUpdateRequest {
  content?: string;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface MessageCreationResult {
  id: string;
  chatId: string;
  content: string;
  senderType: string;
  senderId: string;
  senderName?: string;
  messageType: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}
