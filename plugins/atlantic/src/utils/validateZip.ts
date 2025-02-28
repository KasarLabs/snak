/**
 * Validates if the given buffer contains a valid ZIP file signature.
 *
 * @param buffer - The Buffer object to be validated as a ZIP file.
 * @returns A Promise that resolves to true if the buffer starts with a valid ZIP signature, false otherwise.
 */
export const validateZip = async (buffer: Buffer) => {
  const zipSignature = [0x50, 0x4b, 0x03, 0x04];
  if (buffer.length < zipSignature.length) {
    return false;
  }
  return zipSignature.every((byte, index) => buffer[index] === byte);
};
