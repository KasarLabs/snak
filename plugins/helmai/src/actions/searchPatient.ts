import { searchPatientSchema } from '../schema/index.js';
import { HelmaiHttpClients } from '../utils/httpClient.js';
import { HelmaiErrorHandler } from '../utils/errorHandler.js';
import { ValidationUtils } from '../utils/validation.js';
import { API_ENDPOINTS } from '../constants/api.js';
import { SUCCESS_MESSAGES } from '../constants/healthcare.js';
import { PatientSearchResult } from '../types/Patient.js';
import { z } from 'zod';

type SearchPatientParams = z.infer<typeof searchPatientSchema>;

/**
 * Search for patients by first name and last name
 * Returns empty result if patient is unknown (for OpenAI workflow compatibility)
 *
 * @param params - The search parameters including patient names
 * @returns Promise<string> - JSON string with search results or empty if unknown patient
 */
export const searchPatient = async (
  params: SearchPatientParams
): Promise<string> => {
  try {
    // Validate patient names
    const firstNameValidation = ValidationUtils.validatePatientName(
      params.firstName,
      'First name'
    );
    if (firstNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(firstNameValidation);
    }

    const lastNameValidation = ValidationUtils.validatePatientName(
      params.lastName,
      'Last name'
    );
    if (lastNameValidation.status === 'error') {
      return HelmaiErrorHandler.toJsonString(lastNameValidation);
    }

    // Build query parameters for basic search
    const queryParams: Record<string, unknown> = {
      firstName: firstNameValidation.data,
      lastName: lastNameValidation.data,
      limit: 1, // Only need first match
      offset: 0,
    };

    // Make API request to backend
    const backendClient = HelmaiHttpClients.getBackendClient();
    const response = await backendClient.get<PatientSearchResult>(
      API_ENDPOINTS.PATIENTS.SEARCH,
      { params: queryParams }
    );

    // If no patients found, return empty result (unknown patient)
    if (
      response.status === 'error' ||
      !response.data?.patients ||
      response.data.patients.length === 0
    ) {
      const emptyResult = HelmaiErrorHandler.createSuccess({
        patients: [],
        totalCount: 0,
        hasMore: false,
        message: 'Patient inconnu - aucun résultat trouvé',
        searchCriteria: {
          firstName: firstNameValidation.data,
          lastName: lastNameValidation.data,
        },
      });
      return HelmaiErrorHandler.toJsonString(emptyResult);
    }

    // Return success response with found patient
    const result = HelmaiErrorHandler.createSuccess({
      patients: response.data.patients,
      totalCount: response.data.totalCount,
      hasMore: response.data.hasMore,
      searchCriteria: {
        firstName: firstNameValidation.data,
        lastName: lastNameValidation.data,
      },
      message: SUCCESS_MESSAGES.PATIENT_FOUND,
    });

    return HelmaiErrorHandler.toJsonString(result);
  } catch {
    // For any error, return empty result to indicate unknown patient
    const emptyResult = HelmaiErrorHandler.createSuccess({
      patients: [],
      totalCount: 0,
      hasMore: false,
      message: 'Patient inconnu - erreur lors de la recherche',
      searchCriteria: {
        firstName: params.firstName,
        lastName: params.lastName,
      },
    });
    return HelmaiErrorHandler.toJsonString(emptyResult);
  }
};
