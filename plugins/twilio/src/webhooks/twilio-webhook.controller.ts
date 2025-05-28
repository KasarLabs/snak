import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
} from '@nestjs/common';

export interface TwilioIncomingMessage {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus?: string;
  // WhatsApp specific fields
  ProfileName?: string;
  WaId?: string;
}

interface PatientConversation {
  phoneNumber: string;
  patientName?: string;
  verificationAttempts: number;
  lastMessage: string;
  conversationState: 'initial' | 'verifying' | 'verified' | 'closed';
  lastActivity: Date;
  createdAt: Date; // Add creation timestamp
}

@Controller('twilio/webhook')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);
  private conversationStore = new Map<string, PatientConversation>();
  private readonly MEMORY_EXPIRATION_HOURS = 48; // 48 hours memory expiration

  // Clean up expired conversations every hour
  constructor() {
    setInterval(() => {
      this.cleanupExpiredConversations();
    }, 60 * 60 * 1000); // Run every hour
  }

  @Post('sms')
  @HttpCode(200)
  async handleIncomingSMS(
    @Body() body: TwilioIncomingMessage,
    // @Headers('x-twilio-signature') _signature?: string
  ) {
    this.logger.log(`Incoming SMS from ${body.From}: ${body.Body}`);

    try {
      // Simple response for now - just acknowledge receipt
      this.logger.log(`Processing SMS: ${body.From} -> ${body.Body}`);

      // Generate an AI response
      const response = await this.generateSimpleResponse(body.Body, body.From);

      return { status: 'processed', response };
    } catch (error) {
      this.logger.error('Error handling incoming SMS:', error);
      return { error: 'Internal server error' };
    }
  }

  @Post('whatsapp')
  @HttpCode(200)
  async handleIncomingWhatsApp(
    @Body() body: TwilioIncomingMessage,
    // @Headers('x-twilio-signature') _signature?: string
  ) {
    this.logger.log(`Incoming WhatsApp from ${body.From}: ${body.Body}`);

    try {
      // Simple response for now - just acknowledge receipt
      this.logger.log(`Processing WhatsApp: ${body.From} -> ${body.Body}`);

      // Generate an AI response
      const response = await this.generateSimpleResponse(body.Body, body.From);

      return { status: 'processed', response };
    } catch (error) {
      this.logger.error('Error handling incoming WhatsApp:', error);
      return { error: 'Internal server error' };
    }
  }

  @Post('status')
  @HttpCode(200)
  async handleStatusCallback(
    @Body() body: { MessageSid: string; MessageStatus: string }
  ) {
    this.logger.log(
      `Message status update: ${body.MessageSid} - ${body.MessageStatus}`
    );
    // Handle delivery status updates
    return { status: 'received' };
  }

  @Post('reset-conversation')
  @HttpCode(200)
  async resetConversation(
    @Body() body: { phoneNumber: string }
  ) {
    const phoneNumber = body.phoneNumber.replace(/\D/g, ''); // Remove non-digits
    const deleted = this.conversationStore.delete(phoneNumber);
    
    this.logger.log(`Manual reset conversation for ${phoneNumber}: ${deleted ? 'success' : 'not found'}`);
    
    return { 
      status: 'success', 
      message: `Conversation ${deleted ? 'reset' : 'not found'} for ${phoneNumber}`,
      activeConversations: this.conversationStore.size
    };
  }

  @Post('reset-all-conversations')
  @HttpCode(200)
  async resetAllConversations() {
    const totalConversations = this.conversationStore.size;
    this.conversationStore.clear();
    
    this.logger.log(`Reset all conversations: ${totalConversations} conversations cleared`);
    
    return { 
      status: 'success', 
      message: `All ${totalConversations} conversations have been reset`,
      activeConversations: this.conversationStore.size
    };
  }

  @Post('debug-conversations')
  @HttpCode(200)
  async debugConversations() {
    const conversations = Array.from(this.conversationStore.entries()).map(([phone, conv]) => ({
      phoneNumber: phone,
      state: conv.conversationState,
      verificationAttempts: conv.verificationAttempts,
      lastActivity: conv.lastActivity,
      createdAt: conv.createdAt,
      ageHours: ((new Date().getTime() - conv.createdAt.getTime()) / (1000 * 3600)).toFixed(1)
    }));

    return {
      totalConversations: this.conversationStore.size,
      memoryExpirationHours: this.MEMORY_EXPIRATION_HOURS,
      conversations
    };
  }

  private async generateSimpleResponse(message: string, from: string): Promise<string> {
    try {
      // Manage conversation state
      const phoneNumber = from.replace('whatsapp:', '').replace('+', '');
      const conversation = this.getOrCreateConversation(phoneNumber, message);
      
      // Check if conversation should be closed
      if (conversation.conversationState === 'closed') {
        return "La conversation a été fermée. Pour une nouvelle demande, veuillez contacter le centre dentaire.";
      }

      // Handle conversation flow
      const contextualMessage = this.buildContextualMessage(message, from);
      
      // Call the HelmAI agent with context
      const agentResponse = await this.callHelmAIAgent(contextualMessage, from);
      
      // Update conversation state based on response
      this.updateConversationState(conversation, message, agentResponse);
      
      return agentResponse;
    } catch (error) {
      this.logger.error('Error calling HelmAI agent:', error);
      // Fallback to simple response if agent call fails
      return `I received your message: "${message}". I'm having trouble connecting to my AI brain right now, but I'm working on it!`;
    }
  }

  private getOrCreateConversation(phoneNumber: string, message: string): PatientConversation {
    let conversation = this.conversationStore.get(phoneNumber);
    
    if (!conversation) {
      conversation = {
        phoneNumber,
        verificationAttempts: 0,
        lastMessage: message,
        conversationState: 'initial',
        lastActivity: new Date(),
        createdAt: new Date()
      };
      this.conversationStore.set(phoneNumber, conversation);
      this.logger.log(`Created new conversation for ${phoneNumber}`);
    } else {
      // Check if conversation is expired
      const now = new Date();
      const age = (now.getTime() - conversation.createdAt.getTime()) / (1000 * 3600);
      
      if (age > this.MEMORY_EXPIRATION_HOURS) {
        // Reset expired conversation
        conversation = {
          phoneNumber,
          verificationAttempts: 0,
          lastMessage: message,
          conversationState: 'initial',
          lastActivity: new Date(),
          createdAt: new Date()
        };
        this.conversationStore.set(phoneNumber, conversation);
        this.logger.log(`Reset expired conversation for ${phoneNumber} (age: ${age.toFixed(1)}h)`);
      } else {
        conversation.lastMessage = message;
        conversation.lastActivity = new Date();
      }
    }
    
    return conversation;
  }

  private buildContextualMessage(message: string, from: string): string {
    let context = `Un patient vous contacte via WhatsApp depuis ${from} avec le message: "${message}"`;
    

    
    context += `\n\nCRITICAL INSTRUCTIONS:
WORKFLOW: Follow this precise sequence:
      1. IDENTIFICATION: For new conversations, ask for first AND last name together
      2. VERIFICATION: Call get_patient_informations_by_first_and_last_name immediately when both names are provided
      3. ROUTING: If UNKNOWN → redirect to Doctolib | If KNOWN → proceed to qualification
      4. QUALIFICATION: For known patients, gather precise details about their request through targeted questions
      5. CLASSIFICATION: Internally categorize as: Emergency / Special Request / Appointment / Quote Follow-up
      6. IMPORTANT FOR TASK CREATION: Only after complete qualification that you did , create task with format 'Dr, [clear summary of patient need] in french'

CONVERSATION MANAGEMENT:
      - Maximum 2 attempts for identity verification before polite closure
      - Never reveal internal classification to patient
      - Professional and empathetic tone throughout
      - Send only ONE message per interaction - wait for patient response

AVAILABLE TOOLS:
      - get_patient_informations_by_first_and_last_name: Verify patient identity in database
      - create_task: Create task for dental team after complete qualification (always use centerId: "4322a733-6aba-497e-b54d-6bd04cffd598", priority: LOW/MEDIUM/HIGH only)
      - sendWhatsApp: Send WhatsApp message (use sendTo: "${from.replace('whatsapp:', '')}")

EXECUTION RULES:
      - Use sendWhatsApp tool with sendTo: "${from.replace('whatsapp:', '')}" to respond
      - Send ONLY ONE message then STOP
      - If patient provides first and last name, call get_patient_informations_by_first_and_last_name
      - ONE tool call per turn, then STOP processing
      - Follow your workflow objectives from your configuration`;

    return context;
  }

  private updateConversationState(conversation: PatientConversation, message: string, agentResponse: string): void {
    // Extract patient name if provided
    const nameMatch = message.match(/(?:je suis|mon nom est|je m'appelle)\s+([a-zA-ZÀ-ÿ\s]+)/i);
    if (nameMatch && !conversation.patientName) {
      conversation.patientName = nameMatch[1].trim();
      conversation.conversationState = 'verifying';
    }
    
    // Track verification attempts
    if (agentResponse.toLowerCase().includes('prénom') && agentResponse.toLowerCase().includes('nom')) {
      conversation.verificationAttempts++;
    }
    
    // Close conversation if too many attempts
    if (conversation.verificationAttempts >= 2 && !conversation.patientName) {
      conversation.conversationState = 'closed';
    }
    
    // Mark as verified if patient provided name and agent seems satisfied
    if (conversation.patientName && !agentResponse.toLowerCase().includes('prénom')) {
      conversation.conversationState = 'verified';
    }
  }

  private async callHelmAIAgent(message: string, from: string): Promise<string> {
    const agentId = '95962036-8265-4013-b662-4e032477b7ee'; // Latest HelmaI agent with updated config
    const apiKey = 'helmai-secret-key-2024';
    
    // Use phone number as userId for the existing memory system
    const phoneNumber = from.replace('whatsapp:', '').replace('+', '');
    const userId = `patient-${phoneNumber}`;
    
    // Use CONSISTENT thread ID (no timestamp) to maintain conversation memory
    const threadId = userId; // Same as userId for consistency
    
    const requestBody = {
      request: {
        content: message,
        agentId: agentId, // Direct routing to dental agent
        userId: userId,
        threadId: threadId // Consistent thread for memory continuity
      }
    };

    try {
      const response = await fetch('http://localhost:3001/api/agents/supervisor/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Agent API call failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        // Handle different response formats
        let agentResponse = data.data;
        
        // If response is an object, extract the content
        if (typeof agentResponse === 'object' && agentResponse.content) {
          agentResponse = agentResponse.content;
        } else if (typeof agentResponse === 'object') {
          // If it's an object but no content field, stringify and extract meaningful text
          agentResponse = JSON.stringify(agentResponse);
        }
        
        // Ensure we have a string to work with
        if (typeof agentResponse !== 'string') {
          agentResponse = String(agentResponse);
        }
        
        // SMART FALLBACK: Check if response is empty or meaningless
        const cleanResponse = agentResponse.trim();
        if (!cleanResponse || 
            cleanResponse.length < 3 || 
            cleanResponse === '[]' || 
            cleanResponse === '{}' || 
            cleanResponse === 'null' || 
            cleanResponse === 'undefined' ||
            cleanResponse.includes('fallback mode') ||
            cleanResponse.includes('cannot process') ||
            cleanResponse.includes('[object HumanMessage]')) {
          
          this.logger.warn(`Empty or invalid agent response detected: "${cleanResponse}". Using intelligent fallback.`);
          
          // MEMORY CLEANUP: Reset conversation if corrupted
          if (cleanResponse.includes('fallback mode') || cleanResponse.includes('[object HumanMessage]')) {
            this.logger.warn(`Corrupted memory detected for ${phoneNumber}. Resetting conversation.`);
            this.conversationStore.delete(phoneNumber);
          }
          
          // Intelligent fallback based on message content
          if (message.toLowerCase().includes('douleur') || message.toLowerCase().includes('mal')) {
            return "Je comprends que vous ressentez une douleur. Pour une prise en charge rapide, je vous invite à prendre rendez-vous via Doctolib : https://www.doctolib.fr/cabinet-dentaire/grenoble/centre-dentaire-marechal-foch/booking/motives?specialityId=1&telehealth=false&placeId=practice-194749&bookingFunnelSource=profile";
          } else if (message.toLowerCase().includes('rendez-vous') || message.toLowerCase().includes('rdv')) {
            return "Pour prendre rendez-vous, vous pouvez utiliser notre plateforme en ligne : https://www.doctolib.fr/cabinet-dentaire/grenoble/centre-dentaire-marechal-foch/booking/motives?specialityId=1&telehealth=false&placeId=practice-194749&bookingFunnelSource=profile";
          } else if (message.toLowerCase().includes('urgence') || message.toLowerCase().includes('urgent')) {
            return "Pour une urgence dentaire, je vous recommande de prendre rendez-vous rapidement via Doctolib ou de contacter directement le centre.";
          } else {
            return "Bonjour ! Pour mieux vous aider, pourriez-vous me préciser votre prénom et nom de famille ? Cela me permettra de vérifier si vous êtes déjà patient chez nous.";
          }
        }
        
        // Try to extract just the response part if it's wrapped in explanation
        const lines = cleanResponse.split('\n');
        const responseLine = lines.find((line: string) => 
          line.includes('"') || 
          line.toLowerCase().includes('response:') ||
          line.toLowerCase().includes('reply:')
        );
        
        if (responseLine) {
          // Extract text between quotes or after colon
          const match = responseLine.match(/"([^"]+)"/) || responseLine.match(/(?:response|reply):\s*(.+)/i);
          if (match) {
            return match[1].trim();
          }
        }
        
        // If no specific format found, return the first meaningful line
        const meaningfulLine = lines.find((line: string) => 
          line.trim().length > 10 && 
          !line.includes('WhatsApp') && 
          !line.includes('message')
        );
        
        return meaningfulLine?.trim() || cleanResponse.substring(0, 160) + '...';
      }
      
      throw new Error('Invalid response from agent');
    } catch (error) {
      this.logger.error('Error in agent API call:', error);
      
      // MEMORY CLEANUP: Reset conversation on persistent errors
      if (error instanceof Error && error.message.includes('empty content')) {
        this.logger.warn(`Memory corruption detected for ${phoneNumber}. Resetting conversation.`);
        this.conversationStore.delete(phoneNumber);
      }
      
      // SMART ERROR FALLBACK: Provide contextual response based on message
      if (message.toLowerCase().includes('douleur') || message.toLowerCase().includes('mal')) {
        return "Je comprends votre situation. Pour une consultation d'urgence, veuillez prendre rendez-vous via Doctolib : https://www.doctolib.fr/cabinet-dentaire/grenoble/centre-dentaire-marechal-foch/booking/motives?specialityId=1&telehealth=false&placeId=practice-194749&bookingFunnelSource=profile";
      } else {
        return "Désolé, je rencontre un problème technique. Pour prendre rendez-vous, vous pouvez utiliser Doctolib : https://www.doctolib.fr/cabinet-dentaire/grenoble/centre-dentaire-marechal-foch/booking/motives?specialityId=1&telehealth=false&placeId=practice-194749&bookingFunnelSource=profile";
      }
    }
  }

  private cleanupExpiredConversations() {
    const now = new Date();
    let cleanedCount = 0;
    
    this.conversationStore.forEach((conversation, phoneNumber) => {
      const age = (now.getTime() - conversation.createdAt.getTime()) / (1000 * 3600);
      if (age > this.MEMORY_EXPIRATION_HOURS) {
        this.conversationStore.delete(phoneNumber);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired conversations`);
    }
  }
}
