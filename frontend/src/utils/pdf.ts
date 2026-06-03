import jsPDF from "jspdf";

interface BookingData {
  id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  checkin_code: string;
  mpesa_ref: string | null;
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
