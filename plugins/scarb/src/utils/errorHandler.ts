
/**
 * Formate les erreurs de compilation pour les retourner dans la réponse
 * @param error L'erreur capturée lors de l'exécution de la commande
 * @returns Un message d'erreur formaté
 */
export function formatCompilationError(error: any): string {
  if (!error || !error.stdout) {
    return error?.message || 'Unknown compilation error';
  }
  
  // Format qui décourage la reformulation
  return `[EXACT_ERROR_BEGIN]
${error.stdout}
[EXACT_ERROR_END]`;
} 