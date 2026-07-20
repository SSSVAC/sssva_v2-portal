"use client";

import { useState } from "react";
import { FundStatusTable, type MemberRow } from "@/components/fund-status-table";
import { MonthlyDonationsReport, type DonationMonth, type DonorDonationRow } from "@/components/monthly-donations-report";
import { DonorContactReport, type DonorContactRow } from "@/components/donor-contact-report";
import { MonthlyReport, type MonthlyIncomeRow, type MonthlyExpenseRow, type MonthlyBillRow } from "@/components/monthly-report";
import { SilaiFundReport, type SilaiContributionRow, type SilaiExpenseRow, type SilaiBillRow } from "@/components/silai-fund-report";
import { formatCurrency } from "@/lib/format";

type ReportsTabsProps = {
  fundMinimumAmount: number;
  memberRows: MemberRow[];
  totalCollectedFromMembers: number;
  totalBalanceDue: number;
  notPaidCount: number;
  partiallyPaidCount: number;
  fullyPaidCount: number;
  donationMonths: DonationMonth[];
  donationMonthsShown: number;
  donorRows: DonorDonationRow[];
  donorContactRows: DonorContactRow[];
  monthlyReportMonths: DonationMonth[];
  monthlyReportIncomeRows: MonthlyIncomeRow[];
  monthlyReportExpenseRows: MonthlyExpenseRow[];
  monthlyReportBillRows: MonthlyBillRow[];
  silaiFundContributionRows: SilaiContributionRow[];
  silaiFundExpenseRows: SilaiExpenseRow[];
  silaiFundBillRows: SilaiBillRow[];
};

const TABS = [
  { id: "silai", label: "Silai Contributions" },
  { id: "donations", label: "Member Monthly Donation" },
  { id: "donor-contacts", label: "Monthly Donors" },
  { id: "monthly-report", label: "Monthly Report" },
  { id: "silai-fund", label: "Silai Fund Report" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportsTabs({
  fundMinimumAmount,
  memberRows,
  totalCollectedFromMembers,
  totalBalanceDue,
  notPaidCount,
  partiallyPaidCount,
  fullyPaidCount,
  donationMonths,
  donationMonthsShown,
  donorRows,
  donorContactRows,
  monthlyReportMonths,
  monthlyReportIncomeRows,
  monthlyReportExpenseRows,
  monthlyReportBillRows,
  silaiFundContributionRows,
  silaiFundExpenseRows,
  silaiFundBillRows
}: ReportsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("silai");

  return (
    <div>
      <div className="report-tablist no-print" role="tablist" aria-label="Reports">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={`report-tab ${activeTab === tab.id ? "report-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        className="report-card"
        aria-labelledby="members-silai-contributions-heading"
        data-print-id="silai"
        hidden={activeTab !== "silai"}
      >
        <div className="report-card-head">
          <h2 id="members-silai-contributions-heading">Members Silai Contributions</h2>
          <span className="muted">
            சிலை வைப்பதற்கான நிதி — minimum {formatCurrency(fundMinimumAmount)} per member
          </span>
        </div>

        <div className="metric-grid" aria-label="Fund summary">
          <article className="metric-card">
            <div className="metric-head">
              <span>Members</span>
            </div>
            <div className="metric-value">{memberRows.length}</div>
            <div className="metric-sub">Total members tracked</div>
          </article>
          <article className="metric-card">
            <div className="metric-head">
              <span>Not Paid</span>
            </div>
            <div className="metric-value">{notPaidCount}</div>
            <div className="metric-sub">No contribution recorded</div>
          </article>
          <article className="metric-card">
            <div className="metric-head">
              <span>Partially Paid</span>
            </div>
            <div className="metric-value">{partiallyPaidCount}</div>
            <div className="metric-sub">Below {formatCurrency(fundMinimumAmount)}</div>
          </article>
          <article className="metric-card">
            <div className="metric-head">
              <span>Fully Paid</span>
            </div>
            <div className="metric-value">{fullyPaidCount}</div>
            <div className="metric-sub">Reached {formatCurrency(fundMinimumAmount)}</div>
          </article>
          <article className="metric-card">
            <div className="metric-head">
              <span>Total Paid</span>
            </div>
            <div className="metric-value">{formatCurrency(totalCollectedFromMembers)}</div>
            <div className="metric-sub">Collected from all members</div>
          </article>
          <article className="metric-card">
            <div className="metric-head">
              <span>Balance Due</span>
            </div>
            <div className="metric-value">{formatCurrency(totalBalanceDue)}</div>
            <div className="metric-sub">Outstanding to reach minimum</div>
          </article>
        </div>

        <FundStatusTable members={memberRows} minimumAmount={fundMinimumAmount} />
      </section>

      <section
        className="report-card"
        aria-labelledby="monthly-donations-heading"
        data-print-id="donations"
        hidden={activeTab !== "donations"}
      >
        <div className="report-card-head">
          <h2 id="monthly-donations-heading">Member Monthly Donation</h2>
          <span className="muted">Donations and/or Sponsorships — last {donationMonthsShown} months</span>
        </div>

        <MonthlyDonationsReport months={donationMonths} donors={donorRows} />
      </section>

      <section
        className="report-card"
        aria-labelledby="donor-contacts-heading"
        data-print-id="donor-contacts"
        hidden={activeTab !== "donor-contacts"}
      >
        <div className="report-card-head">
          <h2 id="donor-contacts-heading">Monthly Donors</h2>
          <span className="muted">
            All customers who contributed to Donations and/or Sponsorships in the last {donationMonthsShown} months
          </span>
        </div>

        <DonorContactReport months={donationMonths} donors={donorContactRows} />
      </section>

      <section
        className="report-card"
        aria-labelledby="monthly-report-heading"
        data-print-id="monthly-report"
        hidden={activeTab !== "monthly-report"}
      >
        <div className="report-card-head">
          <h2 id="monthly-report-heading">Monthly Report</h2>
          <span className="muted">Income (Donations, Archanai, Abhishegam), Expenses &amp; Bills for a selected month</span>
        </div>

        <MonthlyReport
          months={monthlyReportMonths}
          incomeRows={monthlyReportIncomeRows}
          expenseRows={monthlyReportExpenseRows}
          billRows={monthlyReportBillRows}
        />
      </section>

      <section
        className="report-card"
        aria-labelledby="silai-fund-report-heading"
        data-print-id="silai-fund"
        hidden={activeTab !== "silai-fund"}
      >
        <div className="report-card-head">
          <h2 id="silai-fund-report-heading">Silai Fund Report</h2>
          <span className="muted">All-time contributions, expenses &amp; bills for the statue installation fund</span>
        </div>

        <SilaiFundReport
          contributionRows={silaiFundContributionRows}
          expenseRows={silaiFundExpenseRows}
          billRows={silaiFundBillRows}
        />
      </section>
    </div>
  );
}
