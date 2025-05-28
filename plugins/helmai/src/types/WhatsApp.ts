export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'location'
    | 'contacts';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    voice?: boolean;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: {
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: {
      phone: string;
      type?: string;
    }[];
  }[];
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        messages?: WhatsAppMessage[];
        statuses?: {
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            expiration_timestamp?: string;
            origin: {
              type: string;
            };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
        }[];
      };
      field: string;
    }[];
  }[];
}

export interface WhatsAppSendMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'location'
    | 'template';
  text?: {
    preview_url?: boolean;
    body: string;
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  audio?: {
    id?: string;
    link?: string;
  };
  video?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Record<string, unknown>[];
  };
  context?: {
    message_id: string;
  };
}

export interface WhatsAppSendMessageResponse {
  messaging_product: string;
  contacts: {
    input: string;
    wa_id: string;
  }[];
  messages: {
    id: string;
  }[];
}

export interface WhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    fbtrace_id?: string;
  };
}
