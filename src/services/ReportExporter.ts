import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportExportRow {
  registerNo: string;
  studentName: string;
  department: string;
  academicYear: string;
  section: string;
  totalSessions: number;
  attendedSessions: number;
  absentSessions: number;
  lateSessions: number;
  attendancePercent: number;
  alertStatus: string;
}

export interface SubjectPeriodExportRow {
  rollNo: string;
  studentName: string;
  date: string;
  period: string;
  subject: string;
  status: string;
}

export interface SubjectSummaryExportRow {
  rollNo: string;
  registerNo: string;
  studentName: string;
  totalClasses: number;
  presentPeriods: number;
  absentPeriods: number;
  attendancePercent: number;
}

export interface MonthlyAttendanceExportRow {
  rollNo: string;
  studentName: string;
  dailyMarks: Record<string, string>;
  totalWorkingDays: number;
  fullDaysPresent: number;
  fullDaysAbsent: number;
  attendancePercent: number;
}

export interface ImportedStudentSpreadsheetRow {
  admissionNo?: string;
  registerNo: string;
  rollNo: string;
  fullName: string;
  department?: string;
  academicYear?: string;
  section?: string;
  email?: string;
  phone?: string;
}

export async function parseStudentSpreadsheetFile(
  file: File,
): Promise<ImportedStudentSpreadsheetRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[firstSheet],
    { defval: '' },
  );

  const pick = (row: Record<string, unknown>, candidates: string[]): string => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const matchKey = keys.find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === candidate.toLowerCase().replace(/[^a-z0-9]/g, ''),
      );
      if (matchKey !== undefined && String(row[matchKey]).trim() !== '') {
        return String(row[matchKey]).trim();
      }
    }
    return '';
  };

  return rawRows
    .map((r) => {
      const registerNo = pick(r, ['registerNo', 'Register Number', 'Reg No', 'Registration No']);
      const admissionNo = pick(r, ['admissionNo', 'Admission Number', 'Admission No']) || registerNo;
      const rollNo = pick(r, ['rollNo', 'Roll Number', 'Roll No']) || registerNo;
      const fullName = pick(r, ['fullName', 'Student Name', 'Name']);
      return {
        admissionNo,
        registerNo,
        rollNo,
        fullName,
        department: pick(r, ['department', 'Department', 'Dept']),
        academicYear: pick(r, ['academicYear', 'Year', 'Academic Year']),
        section: pick(r, ['section', 'Section', 'Sec']),
        email: pick(r, ['email', 'Email', 'E-mail']),
        phone: pick(r, ['phone', 'Phone', 'Contact', 'Mobile']),
      };
    })
    .filter((r) => r.registerNo || r.fullName);
}

export function exportAttendanceCsv(filename: string, rows: ReportExportRow[]): void {
  const headers = [
    'Register No',
    'Student Name',
    'Department',
    'Academic Year',
    'Section',
    'Total Sessions',
    'Present/Excused',
    'Late',
    'Absent',
    'Attendance %',
    'Status',
  ];
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.registerNo,
        `"${r.studentName.replace(/"/g, '""')}"`,
        r.department,
        r.academicYear,
        r.section,
        r.totalSessions,
        r.attendedSessions,
        r.lateSessions,
        r.absentSessions,
        `${r.attendancePercent.toFixed(1)}%`,
        r.alertStatus,
      ].join(','),
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportAttendanceExcel(
  filename: string,
  sheetTitle: string,
  rows: ReportExportRow[],
): void {
  const worksheetData = rows.map((r) => ({
    'Register No': r.registerNo,
    'Student Name': r.studentName,
    Department: r.department,
    'Academic Year': r.academicYear,
    Section: r.section,
    'Total Sessions': r.totalSessions,
    Present: r.attendedSessions,
    Late: r.lateSessions,
    Absent: r.absentSessions,
    'Attendance %': Number(r.attendancePercent.toFixed(1)),
    Status: r.alertStatus,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportSubjectWiseWorkbook(
  subjectName: string,
  periodRows: SubjectPeriodExportRow[],
  summaryRows: SubjectSummaryExportRow[],
): void {
  const cleanName = subjectName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '') || 'Subject_Report';
  const wb = XLSX.utils.book_new();

  const detailData = periodRows.map((r) => ({
    'Roll Number': r.rollNo,
    'Student Name': r.studentName,
    Date: r.date,
    Period: r.period,
    Subject: r.subject,
    'Attendance Status': r.status,
  }));
  const wsDetail = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Period Attendance');

  const summaryData = summaryRows.map((s) => ({
    'Roll Number': s.rollNo,
    'Register Number': s.registerNo,
    'Student Name': s.studentName,
    'Total Classes Conducted': s.totalClasses,
    'Present Periods': s.presentPeriods,
    'Absent Periods': s.absentPeriods,
    'Attendance %': Number(s.attendancePercent.toFixed(1)),
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Student Summary');

  XLSX.writeFile(wb, `${cleanName}.xlsx`);
}

export function exportMonthlyAttendanceWorkbook(
  departmentLabel: string,
  monthKey: string,
  dayColumns: Array<{ date: string; header: string }>,
  rows: MonthlyAttendanceExportRow[],
): void {
  const sheetRows = rows.map((r) => {
    const record: Record<string, string | number> = {
      'Roll Number': r.rollNo,
      'Student Name': r.studentName,
    };
    for (const col of dayColumns) {
      record[col.header] = r.dailyMarks[col.date] ?? '—';
    }
    record['Total working days'] = r.totalWorkingDays;
    record['Full days present'] = r.fullDaysPresent;
    record['Full days absent'] = r.fullDaysAbsent;
    record['Attendance percentage'] = Number(r.attendancePercent.toFixed(1));
    return record;
  });

  const wb = XLSX.utils.book_new();
  const wsGrid = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, wsGrid, 'Monthly Register');

  const summaryRows = rows.map((r) => ({
    'Roll Number': r.rollNo,
    'Student Name': r.studentName,
    Department: departmentLabel,
    Month: monthKey,
    'Total Working Days': r.totalWorkingDays,
    'Full Days Present': r.fullDaysPresent,
    'Full Days Absent': r.fullDaysAbsent,
    'Attendance %': Number(r.attendancePercent.toFixed(1)),
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

  XLSX.writeFile(wb, `${departmentLabel}_${monthKey}_Monthly_Attendance.xlsx`);
}

export function exportAttendancePdf(
  filename: string,
  reportTitle: string,
  subtitle: string,
  rows: ReportExportRow[],
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFillColor(23, 43, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('SMARTATTEND — Attendance Compliance Report', 36, 32);
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153);
  doc.text(`${reportTitle}  |  ${subtitle}`, 36, 52);

  autoTable(doc, {
    startY: 92,
    head: [
      [
        'Register No',
        'Student Name',
        'Dept',
        'Year',
        'Sec',
        'Sessions',
        'Present',
        'Late',
        'Absent',
        'Rate %',
        'Standing',
      ],
    ],
    body: rows.map((r) => [
      r.registerNo,
      r.studentName,
      r.department,
      r.academicYear,
      r.section,
      String(r.totalSessions),
      String(r.attendedSessions),
      String(r.lateSessions),
      String(r.absentSessions),
      `${r.attendancePercent.toFixed(1)}%`,
      r.alertStatus,
    ]),
    headStyles: {
      fillColor: [23, 43, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    styles: {
      fontSize: 8.5,
      textColor: [15, 31, 30],
    },
  });

  doc.save(`${filename}.pdf`);
}
