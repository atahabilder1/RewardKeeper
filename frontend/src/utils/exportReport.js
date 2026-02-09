import jsPDF from "jspdf";
import "jspdf-autotable";

function buildReportData(results, streakData, streakWeek, totalWeeks) {
  const fm = results.full_mark;
  const week = results.dungeon_week;

  // Table 1: Both Full Mark
  const t1Title = `Both Full Mark Reward - Week ${week}`;
  const t1Headers = ["#", "Student", "Problem 1", "Problem 2", "Reward"];
  const t1Rows = results.both_completion.passed.map((name, i) => [
    i + 1,
    name,
    `${fm}/${fm}`,
    `${fm}/${fm}`,
    `${results.reward_points} pts`,
  ]);

  // Table 2: Early Submission
  const t2Title = `Early Submission Reward - Week ${week}`;
  const t2Headers = ["Rank", "Student", "Earliest Full Mark", "Submission Time", "Time Taken", "Reward"];
  const t2Rows = results.early_submission.top5.map((s) => [
    s.rank,
    s.name,
    s.problems,
    s.submission_time,
    `${s.time_taken} min`,
    `${results.reward_points} pts`,
  ]);

  // Table 3: Streak Tracker
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const t3Title = `Streak Tracker (up to Week ${streakWeek})`;
  const t3Headers = ["#", "Student", ...weeks.map((w) => `W${w}`), "Streak"];
  const t3Rows = streakData
    ? streakData.history.map((s, i) => {
        const weekCells = weeks.map((w) => {
          if (w > streakWeek) return "-";
          const val = s.weeks[w] ?? s.weeks[String(w)] ?? false;
          return val ? "Y" : "N";
        });
        return [i + 1, s.name, ...weekCells, `${s.streak_length}w`];
      })
    : [];

  return { t1Title, t1Headers, t1Rows, t2Title, t2Headers, t2Rows, t3Title, t3Headers, t3Rows };
}

function escapeCSV(val) {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCSV(results, streakData, streakWeek, totalWeeks) {
  const { t1Title, t1Headers, t1Rows, t2Title, t2Headers, t2Rows, t3Title, t3Headers, t3Rows } =
    buildReportData(results, streakData, streakWeek, totalWeeks);

  const lines = [];

  const addTable = (title, headers, rows) => {
    lines.push(title);
    lines.push(headers.map(escapeCSV).join(","));
    rows.forEach((row) => lines.push(row.map(escapeCSV).join(",")));
    lines.push(""); // blank line separator
  };

  lines.push(`RewardKeeper Report - Debug Dungeon Week ${results.dungeon_week}`);
  lines.push(`Week Range: ${results.week_range} | Reward Points: ${results.reward_points} | Full Mark: ${results.full_mark}`);
  lines.push("");

  addTable(t1Title, t1Headers, t1Rows);

  lines.push(`Total Passed: ${results.both_completion.total_passed}`);
  lines.push(`Total Not Passed: ${results.both_completion.total_not_passed}`);
  lines.push("");

  addTable(t2Title, t2Headers, t2Rows);

  lines.push(`Total Eligible for Early Submission: ${results.early_submission.total_eligible}`);
  lines.push("");

  if (t3Rows.length > 0) {
    addTable(t3Title, t3Headers, t3Rows);
    if (streakData && streakData.total_rewarded > 0) {
      lines.push(`Students Earning Streak Reward: ${streakData.total_rewarded}`);
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RewardKeeper_Week${results.dungeon_week}_Report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPDF(results, streakData, streakWeek, totalWeeks) {
  const { t1Title, t1Headers, t1Rows, t2Title, t2Headers, t2Rows, t3Title, t3Headers, t3Rows } =
    buildReportData(results, streakData, streakWeek, totalWeeks);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(13, 115, 119);
  doc.text("RewardKeeper Report", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Debug Dungeon Week ${results.dungeon_week} | Week Range: ${results.week_range} | Reward: ${results.reward_points} pts | Full Mark: ${results.full_mark}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  let y = 30;

  const headStyle = { fillColor: [13, 115, 119], textColor: 255, fontStyle: "bold", fontSize: 8 };
  const bodyStyle = { fontSize: 8 };

  // Table 1
  doc.setFontSize(12);
  doc.setTextColor(13, 115, 119);
  doc.text(t1Title, 14, y);
  y += 3;

  doc.autoTable({
    startY: y,
    head: [t1Headers],
    body: t1Rows,
    headStyles: headStyle,
    bodyStyles: bodyStyle,
    margin: { left: 14, right: 14 },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 4;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Total Passed: ${results.both_completion.total_passed}  |  Total Not Passed: ${results.both_completion.total_not_passed}`, 14, y);
  y += 8;

  // Table 2
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 15;
  }
  doc.setFontSize(12);
  doc.setTextColor(13, 115, 119);
  doc.text(t2Title, 14, y);
  y += 3;

  doc.autoTable({
    startY: y,
    head: [t2Headers],
    body: t2Rows,
    headStyles: headStyle,
    bodyStyles: bodyStyle,
    margin: { left: 14, right: 14 },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 4;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Total Eligible: ${results.early_submission.total_eligible}`, 14, y);
  y += 8;

  // Table 3: Streak
  if (t3Rows.length > 0) {
    doc.addPage();
    y = 15;

    doc.setFontSize(12);
    doc.setTextColor(146, 64, 14);
    doc.text(t3Title, 14, y);
    y += 3;

    const streakHeadStyle = { fillColor: [146, 64, 14], textColor: 255, fontStyle: "bold", fontSize: 6, cellPadding: 1.5 };
    const streakBodyStyle = { fontSize: 6, cellPadding: 1.5 };

    doc.autoTable({
      startY: y,
      head: [t3Headers],
      body: t3Rows.map((row) =>
        row.map((cell) => (cell === "Y" ? "\u2714" : cell === "N" ? "\u2718" : cell))
      ),
      headStyles: streakHeadStyle,
      bodyStyles: streakBodyStyle,
      margin: { left: 5, right: 5 },
      theme: "grid",
      columnStyles: Object.fromEntries(
        t3Headers.map((_, i) => {
          if (i === 0) return [i, { cellWidth: 8 }];
          if (i === 1) return [i, { cellWidth: 30 }];
          if (i === t3Headers.length - 1) return [i, { cellWidth: 12 }];
          return [i, { cellWidth: "auto", halign: "center" }];
        })
      ),
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 2 && data.column.index < t3Headers.length - 1) {
          const val = data.cell.raw;
          if (val === "\u2714") data.cell.styles.textColor = [5, 150, 105];
          else if (val === "\u2718") data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.halign = "center";
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;
    if (streakData && streakData.total_rewarded > 0) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Students Earning Streak Reward: ${streakData.total_rewarded}`, 14, y);
    }
  }

  // Footer on each page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`RewardKeeper | Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
  }

  doc.save(`RewardKeeper_Week${results.dungeon_week}_Report.pdf`);
}
