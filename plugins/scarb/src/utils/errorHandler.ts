/**
 * Extrait les erreurs de compilation du stdout de Scarb
 * @param stdout La sortie standard de la commande scarb build
 * @returns Un tableau des messages d'erreur extraits
 */
export function extractScarbErrors(stdout: string): string[] {
  const errors: string[] = [];
  
  // Utiliser une expression régulière pour trouver les erreurs
  // Format typique: "error: Message d'erreur\n --> chemin/vers/fichier.cairo:ligne:colonne"
  const errorRegex = /error:([^\n]+)(\n\s*-->\s*[^\n]+)?/g;
  
  let match;
  while ((match = errorRegex.exec(stdout)) !== null) {
    // Extraire le message d'erreur et le contexte (fichier, ligne)
    const errorMessage = match[1].trim();
    const errorContext = match[2] ? match[2].trim() : '';
    
    errors.push(`${errorMessage}${errorContext ? ' ' + errorContext : ''}`);
  }
  
  // Extraire aussi les avertissements si nécessaire
  const warnRegex = /warn:([^\n]+)(\n\s*-->\s*[^\n]+)?/g;
  
  while ((match = warnRegex.exec(stdout)) !== null) {
    const warnMessage = match[1].trim();
    const warnContext = match[2] ? match[2].trim() : '';
    
    errors.push(`Warning: ${warnMessage}${warnContext ? ' ' + warnContext : ''}`);
  }
  
  return errors;
}

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