import { SnakAgentInterface } from '@snakagent/core';
import { searchPatientSchema } from '../schema/index.js';
import { HelmaiHttpClients } from '../utils/httpClient.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { API_ENDPOINTS } from '../constants/api.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { PatientSearchResult, Patient } from '../types/Patient.js';
import { z } from 'zod';

type SearchPatientParams = z.infer<typeof searchPatientSchema>;

/**
 * Get patient informations by first and last name
 * This function searches for patients in the backend system using their first and last names
 *
 * @param agent - The Snak agent interface
 * @param params - The search parameters including patient names
 * @returns Promise<string> - JSON string with search results
 */
export const getPatientInformationsByFirstAndLastName = async (
  _agent: SnakAgentInterface,
  params: unknown
): Promise<string> => {
  try {
    console.log('🔍 Searching for patient:', JSON.stringify(params));

    // Parse and validate params using the schema
    const parsedParams = searchPatientSchema.parse(params) as SearchPatientParams;

    // Validate patient names
    const firstNameValidation = ValidationUtils.validatePatientName(
      parsedParams.firstName,
      'First name'
    );
    if (firstNameValidation.status === 'error') {
      console.log('❌ First name validation failed:', firstNameValidation);
      return HelmaiErrorHandler.toJsonString(firstNameValidation);
    }

    const lastNameValidation = ValidationUtils.validatePatientName(
      parsedParams.lastName,
      'Last name'
    );
    if (lastNameValidation.status === 'error') {
      console.log('❌ Last name validation failed:', lastNameValidation);
      return HelmaiErrorHandler.toJsonString(lastNameValidation);
    }

    // Build query parameters for the API call
    const queryParams: Record<string, unknown> = {
      firstName: firstNameValidation.data,
      lastName: lastNameValidation.data,
      limit: parsedParams.limit || 10,
      offset: parsedParams.offset || 0,
    };

    // Add optional parameters if provided
    if (parsedParams.phoneNumber) {
      const phoneValidation = ValidationUtils.validatePhoneNumber(parsedParams.phoneNumber);
      if (phoneValidation.status === 'success') {
        queryParams.phoneNumber = phoneValidation.data;
      }
    }

    if (parsedParams.centerId) {
      const centerIdValidation = ValidationUtils.validateUUID(parsedParams.centerId, 'Center ID');
      if (centerIdValidation.status === 'success') {
        queryParams.centerId = centerIdValidation.data;
      }
    }

    console.log('📡 Making API request with params:', queryParams);

    // Make API request to backend
    const backendClient = HelmaiHttpClients.getBackendClient();
    const response = await backendClient.get<Patient[]>(
      API_ENDPOINTS.PATIENTS.SEARCH,
      { params: queryParams }
    );

    console.log('📥 API response status:', response.status);

    // Handle API errors
    if (response.status === 'error') {
      console.log('❌ API error:', response);
      return HelmaiErrorHandler.toJsonString(response);
    }

    // Handle empty results - API returns direct array, not wrapped object
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      console.log('📭 No patients found');
      const emptyResult = HelmaiErrorHandler.createSuccess({
        patients: [],
        totalCount: 0,
        hasMore: false,
        message: 'Aucun patient trouvé avec ces critères',
        searchCriteria: {
          firstName: firstNameValidation.data,
          lastName: lastNameValidation.data,
        },
      });
      return HelmaiErrorHandler.toJsonString(emptyResult);
    }

    console.log('✅ Found patients:', response.data.length);

    // Return success response with found patients
    const result = HelmaiErrorHandler.createSuccess({
      patients: response.data,
      totalCount: response.data.length,
      hasMore: false, // API doesn't provide pagination info, so assume no more
      searchCriteria: {
        firstName: firstNameValidation.data,
        lastName: lastNameValidation.data,
      },
      message: SUCCESS_MESSAGES.PATIENT_FOUND,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch (error) {
    console.log('💥 Unexpected error:', error);
    
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      const errorResult = HelmaiErrorHandler.createError(
        'VALIDATION_ERROR',
        'Invalid parameters provided',
        error.errors
      );
      return HelmaiErrorHandler.toJsonString(errorResult);
    }
    
    const errorResult = HelmaiErrorHandler.createError(
      'PATIENT_SEARCH_ERROR',
      'Failed to search for patient',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return HelmaiErrorHandler.toJsonString(errorResult);
  }
};
