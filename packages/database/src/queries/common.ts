/**
 * A type safe marker used to specify if a database column contains its id.
 *
 * This is used to differentiate between interfaces used to insert and retrieve
 * rows while minimizing code duplication.
 */
export enum Id {
  Id,
  NoId,
}
