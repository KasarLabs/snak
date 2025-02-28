/**
 * Base interface for operation status
 */
export interface Status {
  status: 'success' | 'failure';
}

/**
 * Base interface for trove operation results
 */
export interface TroveActionResult extends Status {
  /** ID of the trove */
  trove_id?: string;
  /** Transaction hash of the operation */
  transaction_hash?: string;
  /** Error message if operation failed */
  error?: string;
  /** Current step in multi-step operation */
  step?: string;
}

/**
 * Interface for operations that involve borrowing fees
 */
export interface BorrowActionResult {
  /** Amount of borrowing fee paid */
  borrow_fee?: string;
  /** Borrowing fee as a percentage */
  borrow_fee_pct?: string;
}

/**
 * Interface for operations that modify trove debt
 */
export interface DebtActionResult {
  /** Amount of debt modified */
  amount?: string;
  /** Debt before operation */
  before_debt?: string;
  /** Debt after operation */
  after_debt?: string;
  /** Loan-to-value ratio before operation */
  before_ltv?: string;
  /** Loan-to-value ratio after operation */
  after_ltv?: string;
}

/**
 * Interface for operations that modify trove collateral
 */
export interface CollateralActionResult {
  /** Trove value before operation */
  before_value?: string;
  /** Trove value after operation */
  after_value?: string;
  /** Loan-to-value ratio before operation */
  before_ltv?: string;
  /** Loan-to-value ratio after operation */
  after_ltv?: string;
}

/**
 * Result interface for opening a new trove
 */
export interface OpenTroveResult
  extends TroveActionResult,
    BorrowActionResult {}

/**
 * Result interface for repaying trove debt
 */
export interface RepayTroveResult extends TroveActionResult, DebtActionResult {}

/**
 * Result interface for borrowing from a trove
 */
export interface BorrowTroveResult
  extends TroveActionResult,
    DebtActionResult,
    BorrowActionResult {}

/**
 * Result interface for depositing collateral to a trove
 */
export interface DepositTroveResult
  extends TroveActionResult,
    CollateralActionResult {}

/**
 * Result interface for withdrawing collateral from a trove
 */
export interface WithdrawTroveResult
  extends TroveActionResult,
    CollateralActionResult {}

/**
 * Result interface for retrieving user's troves
 */
export interface GetUserTrovesResult extends Status {
  /** Array of trove IDs owned by user */
  troves?: string[];
}

/**
 * Result interface for retrieving trove health metrics
 */
export interface GetTroveHealthResult extends Status {
  /** ID of the trove */
  trove_id?: string;
  /** Current debt of the trove */
  debt?: string;
  /** Current value of trove collateral */
  value?: string;
  /** Current loan-to-value ratio */
  ltv?: string;
  /** LTV threshold for liquidation */
  threshold?: string;
}

/**
 * Result interface for retrieving current borrow fee
 */
export interface GetBorrowFeeResult extends Status {
  /** Current borrowing fee */
  borrow_fee?: string;
}
