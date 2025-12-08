import jsPDF from 'jspdf';

export interface VisitPhotoForPdf {
  id: string;
  photo_url: string;
  caption?: string | null;
  category?: string | null;
}

export interface VisitInspectionForPdf {
  category: string;
  item: string;
  status: string;
  notes?: string | null;
}

export interface VisitForPdf {
  id: string;
  visit_number: number;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  confirmed_at?: string | null;
  status: string;
  findings: string | null;
  recommendations: string | null;
  work_performed: string | null;
  location: string | null;
  duration_minutes: number | null;
  parts_used?: any[];
  customer_name?: string | null;
  customer_email?: string | null;
  technician_name: string;
  technician_email: string;
  inspections?: VisitInspectionForPdf[];
  photos?: VisitPhotoForPdf[];
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Unable to load image for PDF:', url, e);
    return null;
  }
}

async function buildVisitReportDoc(visit: VisitForPdf) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addSectionTitle = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const addParagraph = (text: string) => {
    const clean = text || '—';
    const lines = doc.splitTextToSize(clean, contentWidth);
    lines.forEach(line => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 12;
    });
    y += 4;
  };

  const ensureSpace = (extra = 0) => {
    if (y + extra > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Subscription Visit Report', margin, y);
  y += 18;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Visit #${visit.visit_number}`, margin, y);
  y += 20;

  // Visit info
  addSectionTitle('Visit Information');
  const infoLeft = [
    `Status: ${visit.status.toUpperCase()}`,
    `Scheduled: ${
      visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleDateString() : 'Not scheduled'
    }`,
    `Started: ${visit.started_at ? new Date(visit.started_at).toLocaleString() : '—'}`
  ];
  const infoRight = [
    `Completed: ${visit.completed_at ? new Date(visit.completed_at).toLocaleString() : '—'}`,
    `Confirmed: ${visit.confirmed_at ? new Date(visit.confirmed_at).toLocaleString() : '—'}`,
    `Duration: ${visit.duration_minutes ? `${visit.duration_minutes} minutes` : '—'}`
  ];

  const colWidth = contentWidth / 2;
  infoLeft.forEach((line, idx) => {
    ensureSpace();
    doc.text(line, margin, y + idx * 12);
  });
  infoRight.forEach((line, idx) => {
    ensureSpace();
    doc.text(line, margin + colWidth, y + idx * 12);
  });
  y += infoLeft.length * 12 + 10;

  if (visit.location) {
    doc.text(`Location: ${visit.location}`, margin, y);
    y += 16;
  } else {
    y += 6;
  }

  // People
  addSectionTitle('People');
  if (visit.customer_name || visit.customer_email) {
    addParagraph(
      `Customer: ${visit.customer_name || '—'}\nEmail: ${visit.customer_email || '—'}`
    );
  }
  addParagraph(`Technician: ${visit.technician_name}\nEmail: ${visit.technician_email}`);

  // Narrative sections
  addSectionTitle('Technician Report');
  addParagraph(visit.work_performed || visit.recommendations || visit.findings || 'No report provided');

  addSectionTitle('Findings');
  addParagraph(visit.findings || 'No findings recorded');

  addSectionTitle('Work Performed');
  addParagraph(visit.work_performed || 'No work details provided');

  // Parts
  addSectionTitle('Parts Used');
  if (visit.parts_used && visit.parts_used.length > 0) {
    const partsLines = visit.parts_used.map(
      (part: any, idx: number) =>
        `${idx + 1}. ${part.name || part.part_name || 'Unknown'} - Qty: ${
          part.quantity || 1
        }${part.cost ? ` - Cost: $${part.cost}` : ''}`
    );
    addParagraph(partsLines.join('\n'));
  } else {
    addParagraph('No parts used');
  }

  // Recommendations
  addSectionTitle('Recommendations');
  addParagraph(visit.recommendations || 'No recommendations provided');

  // Inspections
  addSectionTitle('Inspection Results');
  if (visit.inspections && visit.inspections.length > 0) {
    const lines = visit.inspections.map(
      (insp, idx) =>
        `${idx + 1}. ${insp.category} - ${insp.item}: ${insp.status.toUpperCase()}${
          insp.notes ? ` (Notes: ${insp.notes})` : ''
        }`
    );
    addParagraph(lines.join('\n'));
  } else {
    addParagraph('No inspection data available');
  }

  // Evidence photos
  addSectionTitle('Evidence Photos & Videos');
  if (visit.photos && visit.photos.length > 0) {
    y += 4;
    const thumbSize = 80;
    const gap = 8;
    const perRow = Math.max(1, Math.floor(contentWidth / (thumbSize + gap)));

    for (let i = 0; i < visit.photos.length; i++) {
      const photo = visit.photos[i];
      ensureSpace(thumbSize + 30);

      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = margin + col * (thumbSize + gap);
      const rowY = y + row * (thumbSize + 30);

      const dataUrl = await toDataUrl(photo.photo_url);
      if (dataUrl) {
        doc.addImage(dataUrl, 'JPEG', x, rowY, thumbSize, thumbSize);
      }

      const caption = (photo.caption || 'Evidence').substring(0, 30);
      doc.setFontSize(8);
      doc.text(caption, x, rowY + thumbSize + 10, { maxWidth: thumbSize });
      doc.setFontSize(10);

      if ((i + 1) % perRow === 0) {
        y = rowY + thumbSize + 26;
      }
    }

    // Move y below last row of thumbnails
    const rows = Math.ceil((visit.photos.length || 1) / Math.max(1, Math.floor(contentWidth / (thumbSize + gap))));
    y += rows * (thumbSize + 30);
  } else {
    addParagraph('No evidence photos or videos uploaded for this visit.');
  }

  // Footer
  ensureSpace(30);
  doc.setFontSize(9);
  doc.setTextColor('#9ca3af');
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - margin);

  return doc;
}

export async function generateVisitReportPdf(visit: VisitForPdf, fileName?: string) {
  const doc = await buildVisitReportDoc(visit);
  const finalName = fileName || `visit-${visit.visit_number}-report.pdf`;
  doc.save(finalName);
}

