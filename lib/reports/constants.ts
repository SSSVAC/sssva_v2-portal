// Shared invoice item_name / expense-bill account_name constants used
// across multiple report definitions. Kept in one place so the walking
// order / naming conventions can't drift between reports that need the
// same match (e.g. Silai contributions vs. Silai fund vs. Silai by group).

// Invoice line-item names that mark a contribution to the statue
// installation fund. Matched case-insensitively/contains, since Zoho line
// item text may carry extra whitespace or minor variation, and Zoho has
// recorded these contributions under two different item names.
export const FUND_ITEM_NAMES = ["சிலை வைப்பதற்கான நிதி", "Murugar & Iyyapan Statue Funds"];
export const FUND_MINIMUM_AMOUNT = 3000;

// Invoice line-item name used for general recurring donations, matched the
// same case-insensitive/contains way as FUND_ITEM_NAMES.
export const DONATION_ITEM_NAME = "Donations and/or Sponsorships";
export const DONATION_MONTHS_SHOWN = 5;

// Archanai and Abhishegam income are recorded under both an English and a
// Tamil item name in Zoho. Note: "Abishegam" (regular abhishegam) and
// "வருஷாபிஷேகம்" (Varusha Abhishegam, the annual one) are distinct services
// and are intentionally not merged here.
export const ARCHANAI_ITEM_NAMES = ["Archanai", "அர்ச்சனை"];
export const ABHISHEGAM_ITEM_NAMES = ["Abishegam"];
// Catch-all invoice item name for miscellaneous income (e.g. from the
// "General" customer) that doesn't fit the other named categories.
export const OTHERS_ITEM_NAMES = ["Others"];
export const MONTHLY_REPORT_MONTHS_SHOWN = 24;

// Zoho expense/bill account name used for statue-fund costs. Excluded from
// the general Monthly Report (tracked separately there) and used as the
// positive match for the dedicated Silai Fund Report.
export const SILAI_EXPENSE_ACCOUNT_NAME = "Prathishta Consecration Expenses";

// Event-fund account names, also excluded from the general Monthly Report
// since each has its own dedicated report.
export const UGADI_EXPENSE_ACCOUNT = "Ugadi";
export const VARUSHABISHEGAM_EXPENSE_ACCOUNT = "Varushabishekam Expenses";
// No Marghazhi Poojai expense/bill exists in Zoho yet, so this is a guess
// matching the naming convention above — update if the real account name
// differs once one is recorded.
export const MARGHAZHI_POOJAI_EXPENSE_ACCOUNT = "Marghazhi Poojai";

// Income item name for one-time association registration fees, and the
// matching expense/bill account for registration-related costs.
export const REGISTRATION_ITEM_NAME = "Association Registration Fund";
export const REGISTRATION_EXPENSE_ACCOUNT = "Temple Registration Expenses";

export const MONTHLY_REPORT_EXCLUDED_ACCOUNTS = [
  SILAI_EXPENSE_ACCOUNT_NAME,
  UGADI_EXPENSE_ACCOUNT,
  VARUSHABISHEGAM_EXPENSE_ACCOUNT,
  MARGHAZHI_POOJAI_EXPENSE_ACCOUNT,
  REGISTRATION_EXPENSE_ACCOUNT
];
