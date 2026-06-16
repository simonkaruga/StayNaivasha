import jsPDF from "jspdf";

interface BookingData {
  id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  platform_fee: number;
  checkin_code: string;
  mpesa_ref: string | null;
  company_name?: string | null;
  kra_pin?: string | null;
  group_name?: string | null;
  is_corporate?: boolean;
}

export function generateBookingPDF(booking: BookingData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(13, 61, 32); // forest green
  doc.rect(0, 0, pageW, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("StayNaivasha", 15, 12);
  doc.setFontSize(9);
  doc.text("staynaivasha.co.ke", 15, 20);
  doc.text("Booking Confirmation", pageW - 15, 18, { align: "right" });

  // Check-in code — large and prominent
  doc.setTextColor(13, 61, 32);
  doc.setFontSize(11);
  doc.text("YOUR CHECK-IN CODE", pageW / 2, 48, { align: "center" });

  doc.setFontSize(48);
  doc.setFont("helvetica", "bold");
  doc.text(booking.checkin_code, pageW / 2, 68, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Show this code to the property owner on arrival", pageW / 2, 76, { align: "center" });

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 82, pageW - 15, 82);

  // Booking details
  const rows: [string, string][] = [
    ["Booking ID",   booking.id.slice(0, 8).toUpperCase()],
    ["Check-in",     booking.check_in],
    ["Check-out",    booking.check_out],
    ["Total paid",   `KES ${booking.total_amount.toLocaleString()}`],
    ["M-Pesa Ref",   booking.mpesa_ref ?? "—"],
  ];

  doc.setFontSize(10);
  let y = 94;
  for (const [label, value] of rows) {
    doc.setTextColor(120, 120, 120);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    doc.text(value, 90, y);
    y += 10;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(
    "Kenya's first local-first vacation rental platform · Built by a Naivasha resident",
    pageW / 2, 270, { align: "center" }
  );

  doc.save(`staynaivasha-booking-${booking.id.slice(0, 8)}.pdf`);
}

export function generateCorporateInvoicePDF(booking: BookingData, propertyTitle: string): void {
  const doc   = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const nights = Math.max(1,
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  );
  const base  = booking.total_amount - booking.platform_fee - Math.round((booking.total_amount - booking.platform_fee) * 0.02);
  const levy  = Math.round(base * 0.02);
  const invoiceNo = `SN-INV-${booking.id.slice(0, 8).toUpperCase()}`;
  const today = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  // Header
  doc.setFillColor(30, 74, 34);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("StayNaivasha", 15, 14);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("staynaivasha.co.ke  ·  Naivasha, Kenya", 15, 22);
  doc.text("P.O. Box 1, Naivasha 20117", 15, 28);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", pageW - 15, 20, { align: "right" });

  // Invoice meta
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice No:  ${invoiceNo}`, 15, 46);
  doc.text(`Invoice Date: ${today}`, 15, 53);
  doc.text(`M-Pesa Ref:  ${booking.mpesa_ref ?? "—"}`, 15, 60);

  // Bill to
  doc.setFillColor(245, 248, 245);
  doc.rect(15, 68, pageW - 30, 28, "F");
  doc.setTextColor(30, 74, 34); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("BILLED TO", 20, 76);
  doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(booking.company_name ?? "—", 20, 84);
  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text(`KRA PIN: ${booking.kra_pin ?? "—"}`, 20, 91);
  if (booking.group_name) doc.text(`Group: ${booking.group_name}`, 20, 96);

  // Table header
  const tY = 108;
  doc.setFillColor(30, 74, 34);
  doc.rect(15, tY - 5, pageW - 30, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("Description", 18, tY);
  doc.text("Nights", 120, tY);
  doc.text("Amount (KES)", pageW - 18, tY, { align: "right" });

  // Line items
  const lines: [string, string, number][] = [
    [`Accommodation — ${propertyTitle}`, String(nights), base],
    ["Tourism Levy (2%)", "", levy],
    ["StayNaivasha Service Fee", "", booking.platform_fee],
  ];
  doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  let ly = tY + 12;
  lines.forEach(([desc, nts, amt], i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 252, 250); doc.rect(15, ly - 5, pageW - 30, 9, "F"); }
    doc.text(desc, 18, ly);
    if (nts) doc.text(nts, 120, ly);
    doc.text(`KES ${amt.toLocaleString()}`, pageW - 18, ly, { align: "right" });
    ly += 11;
  });

  // Total
  doc.setDrawColor(30, 74, 34); doc.line(15, ly, pageW - 15, ly);
  ly += 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 74, 34);
  doc.text("TOTAL", 18, ly);
  doc.text(`KES ${booking.total_amount.toLocaleString()}`, pageW - 18, ly, { align: "right" });

  // Footer
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 140);
  doc.text("This is a computer-generated invoice and does not require a physical signature.", pageW / 2, 260, { align: "center" });
  doc.text("StayNaivasha is registered under the Tourism Act of Kenya. Tourism Levy remitted to TRA.", pageW / 2, 266, { align: "center" });

  doc.save(`staynaivasha-invoice-${invoiceNo}.pdf`);
}

interface AgentVoucherData {
  booking_id: string;
  property_title: string;
  check_in: string;
  check_out: string;
  commission_kes: number;
  status: string;
  paid_at: string | null;
}

export function generateAgentVoucherPDF(data: AgentVoucherData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  // Header
  doc.setFillColor(30, 74, 34);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("StayNaivasha", 15, 13);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Agent Commission Voucher", pageW - 15, 18, { align: "right" });

  // Booking summary box
  doc.setFillColor(245, 248, 245);
  doc.rect(15, 40, pageW - 30, 50, "F");
  doc.setTextColor(30, 74, 34); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("BOOKING DETAILS", 20, 50);

  doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(data.property_title, 20, 60);

  doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  const rows: [string, string][] = [
    ["Booking ID",  data.booking_id.slice(0, 8).toUpperCase()],
    ["Check-in",    data.check_in],
    ["Check-out",   data.check_out],
    ["Status",      data.status.toUpperCase()],
  ];
  let y = 68;
  rows.forEach(([label, val]) => {
    doc.setTextColor(120, 120, 120); doc.text(label, 20, y);
    doc.setTextColor(20, 20, 20);   doc.text(val, 90, y);
    y += 8;
  });

  // Commission highlight
  doc.setFillColor(30, 74, 34);
  doc.rect(15, 104, pageW - 30, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text("Your Commission", 20, 116);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text(`KES ${data.commission_kes.toLocaleString()}`, pageW - 18, 116, { align: "right" });

  if (data.paid_at) {
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(
      `Paid on ${new Date(data.paid_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`,
      pageW / 2, 125, { align: "center" }
    );
  }

  // Footer
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated on ${today}  ·  staynaivasha.co.ke`, pageW / 2, 260, { align: "center" });
  doc.text("Commission paid via M-Pesa. Contact support@staynaivasha.co.ke for queries.", pageW / 2, 266, { align: "center" });

  doc.save(`staynaivasha-agent-voucher-${data.booking_id.slice(0, 8)}.pdf`);
}
