import { FundStatusTable, type MemberRow } from "@/components/fund-status-table";
import { formatCurrency } from "@/lib/format";

type SilaiContributionsReportProps = {
  memberRows: MemberRow[];
  fundMinimumAmount: number;
};

export function SilaiContributionsReport({ memberRows, fundMinimumAmount }: SilaiContributionsReportProps) {
  const totalCollectedFromMembers = memberRows.reduce((sum, member) => sum + member.paid, 0);
  const totalBalanceDue = memberRows.reduce((sum, member) => sum + member.balanceDue, 0);
  const notPaidCount = memberRows.filter((member) => member.status === "not_paid").length;
  const partiallyPaidCount = memberRows.filter((member) => member.status === "partially_paid").length;
  const fullyPaidCount = memberRows.filter((member) => member.status === "fully_paid").length;

  return (
    <div className="stack">
      {/* Money leads, then the three payment states in the same colours
          they carry in the table and on the dashboard donut — so a tile,
          a pill and a chart slice all agree on what "not paid" looks like. */}
      <div className="metric-grid" aria-label="Fund summary">
        <article className="metric-card" data-emphasis="lead">
          <div className="metric-head">
            <span>Total Paid</span>
          </div>
          <div className="metric-value">{formatCurrency(totalCollectedFromMembers)}</div>
          <div className="metric-sub">Collected from all members</div>
        </article>
        <article className="metric-card" data-state={totalBalanceDue > 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Balance Due</span>
          </div>
          <div className="metric-value">{formatCurrency(totalBalanceDue)}</div>
          <div className="metric-sub">Outstanding to reach minimum</div>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Members</span>
          </div>
          <div className="metric-value">{memberRows.length}</div>
          <div className="metric-sub">Total members tracked</div>
        </article>
        <article className="metric-card" data-state={notPaidCount > 0 ? "critical" : "positive"}>
          <div className="metric-head">
            <span>Not Paid</span>
          </div>
          <div className="metric-value">{notPaidCount}</div>
          <div className="metric-sub">No contribution recorded</div>
        </article>
        <article className="metric-card" data-state={partiallyPaidCount > 0 ? "warning" : "positive"}>
          <div className="metric-head">
            <span>Partially Paid</span>
          </div>
          <div className="metric-value">{partiallyPaidCount}</div>
          <div className="metric-sub">Below {formatCurrency(fundMinimumAmount)}</div>
        </article>
        <article className="metric-card" data-state="positive">
          <div className="metric-head">
            <span>Fully Paid</span>
          </div>
          <div className="metric-value">{fullyPaidCount}</div>
          <div className="metric-sub">Reached {formatCurrency(fundMinimumAmount)}</div>
        </article>
      </div>

      <FundStatusTable members={memberRows} minimumAmount={fundMinimumAmount} />
    </div>
  );
}
