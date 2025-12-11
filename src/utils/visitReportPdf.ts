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
    // Skip video files - they can't be displayed as images in PDF
    if (url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov') || url.toLowerCase().includes('.webm')) {
      return null;
    }

    // Add CORS mode for Supabase URLs
    const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (!res.ok) {
      console.warn('Failed to fetch image:', res.status, url);
      return null;
    }
    const blob = await res.blob();
    
    // Check if it's actually an image
    if (!blob.type.startsWith('image/')) {
      console.warn('URL is not an image:', blob.type, url);
      return null;
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => {
        console.warn('FileReader error for:', url);
        reject(reader.error);
      };
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
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const theme = {
    bg: '#0b2440',
    panel: '#12385b',
    panelAlt: '#102f4d',
    text: '#e8f1fb',
    muted: '#9fb3c8',
    accent: '#2dd4bf',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#fb7185',
    border: '#1f4a78'
  };

  const ensureSpace = (extra = 0) => {
    if (y + extra > pageHeight - margin) {
      doc.addPage();
      // paint background on new page
      doc.setFillColor(theme.bg);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      y = margin;
    }
  };

  const drawCard = (x: number, width: number, title: string, lines: string | string[], minHeight = 50) => {
    const startY = y;
    doc.setFillColor(theme.panel);
    doc.setDrawColor(theme.border);
    doc.roundedRect(x, y, width, minHeight, 6, 6, 'FD');

    doc.setTextColor(theme.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), x + 10, y + 14);

    doc.setTextColor(theme.text);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const body = Array.isArray(lines) ? lines.join('\n') : lines;
    const wrapped = doc.splitTextToSize(body || '—', width - 20);
    let textY = y + 26;
    wrapped.forEach(line => {
      doc.text(line, x + 10, textY);
      textY += 11;
    });

    const heightUsed = Math.max(minHeight, (wrapped.length > 0 ? textY - y + 4 : minHeight));
    y = startY + heightUsed + 8;
  };

  const drawChip = (label: string, color: string, x: number, yPos: number) => {
    doc.setFillColor(color);
    doc.setTextColor('#0b1220');
    doc.setFontSize(8);
    const padding = 5;
    const textWidth = doc.getTextWidth(label);
    const chipWidth = textWidth + padding * 2;
    doc.roundedRect(x, yPos - 10, chipWidth, 16, 5, 5, 'F');
    doc.text(label, x + padding, yPos);
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(30);
    doc.setTextColor(theme.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), margin, y);
    y += 14;
  };

  const addListBadges = (
    items: Array<{ title: string; subtitle?: string; status?: string }>,
    colorByStatus?: (status?: string) => string
  ) => {
    const cardPadding = 10;
    const cardWidth = contentWidth;
    const cardHeight = 32;
    items.forEach(item => {
      ensureSpace(40);
      doc.setFillColor(theme.panelAlt);
      doc.setDrawColor(theme.border);
      doc.roundedRect(margin, y, cardWidth, cardHeight, 6, 6, 'FD');

      doc.setTextColor(theme.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(item.title, margin + cardPadding, y + 12);

      if (item.subtitle) {
        doc.setTextColor(theme.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(item.subtitle, margin + cardPadding, y + 24);
      }

      if (item.status) {
        const chipColor = colorByStatus ? colorByStatus(item.status) : theme.accent;
        const statusLabel = item.status.toUpperCase();
        doc.setFontSize(8);
        const textWidth = doc.getTextWidth(statusLabel) + 10;
        drawChip(statusLabel, chipColor, margin + cardWidth - textWidth - 8, y + 16);
      }
      y += cardHeight + 6;
    });
    y += 2;
  };

  const statusColor = (status?: string) => {
    if (!status) return theme.accent;
    const normalized = status.toLowerCase();
    if (normalized.includes('urgent')) return theme.danger;
    if (normalized.includes('critical')) return theme.danger;
    if (normalized.includes('need')) return theme.warning;
    if (normalized.includes('pass') || normalized.includes('good') || normalized.includes('completed')) return theme.success;
    return theme.accent;
  };

  // Paint background
  doc.setFillColor(theme.bg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(theme.text);

  // Header row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Visit #${visit.visit_number}`, margin, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(theme.muted);
  doc.text(visit.customer_name ? visit.customer_name : 'Customer', margin, y + 20);
  if (visit.customer_email) {
    doc.text(visit.customer_email, margin, y + 32);
  }

  // Status chip and completion info
  const statusLabel = visit.status ? visit.status.toUpperCase().replace(/_/g, ' ') : 'STATUS';
  drawChip(statusLabel, statusColor(statusLabel), pageWidth - margin - 100, y + 8);
  doc.setTextColor(theme.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Completed: ${visit.completed_at ? new Date(visit.completed_at).toLocaleString() : '—'}`,
    pageWidth - margin - 100,
    y + 24,
    { align: 'right', maxWidth: 90 }
  );
  y += 40;

  // Tech & Location cards side by side
  const half = (contentWidth - 12) / 2;
  ensureSpace(70);
  const currentY = y;
  drawCard(margin, half, 'Technician', [`${visit.technician_name || '—'}`, visit.technician_email || '—'], 50);
  y = currentY;
  drawCard(margin + half + 12, half, 'Location', visit.location || 'Not specified', 50);
  y += 4;

  // Started / Completed / Duration
  const timeCardHeight = 50;
  ensureSpace(timeCardHeight + 12);
  const yTime = y;
  drawCard(
    margin,
    half,
    'Started at',
    visit.started_at ? new Date(visit.started_at).toLocaleString() : '—',
    timeCardHeight
  );
  y = yTime;
  drawCard(
    margin + half + 12,
    half,
    'Completed at',
    visit.completed_at ? new Date(visit.completed_at).toLocaleString() : '—',
    timeCardHeight
  );
  y += 4;

  // Recommendations / Work performed / Parts
  addSectionTitle('Recommendations');
  drawCard(margin, contentWidth, 'Recommendations', visit.recommendations || 'No recommendations provided', 50);

  addSectionTitle('Work Performed');
  drawCard(
    margin,
    contentWidth,
    'Technician Report',
    visit.work_performed || visit.recommendations || visit.findings || 'No report provided',
    50
  );

  addSectionTitle('Parts Used');
  if (visit.parts_used && visit.parts_used.length > 0) {
    const partsLines = visit.parts_used.map(
      (part: any, idx: number) =>
        `${idx + 1}. ${part.name || part.part_name || 'Part'} • Qty: ${part.quantity || 1}${
          part.cost ? ` • Cost: $${part.cost}` : ''
        }`
    );
    drawCard(margin, contentWidth, 'Parts', partsLines, 50);
  } else {
    drawCard(margin, contentWidth, 'Parts', 'No parts used', 50);
  }

  // Findings (parsed best-effort)
  const parsedFindings: Array<{ title: string; subtitle?: string; status?: string }> = [];
  if (visit.findings) {
    visit.findings
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => {
        const [systemPart, neededPart] = line.split(' - Needed:').map(part => part?.trim());
        let status: string | undefined;
        let cleanTitle = systemPart.replace('System:', 'System').trim();
        
        // Detect and remove status from title
        if (systemPart.toLowerCase().includes('urgent attention')) {
          status = 'URGENT ATTENTION';
          cleanTitle = cleanTitle.replace(/urgent attention/gi, '').trim();
        } else if (systemPart.toLowerCase().includes('needs attention')) {
          status = 'NEEDS ATTENTION';
          cleanTitle = cleanTitle.replace(/needs attention/gi, '').trim();
        } else if (systemPart.toLowerCase().includes('pass')) {
          status = 'PASS';
          cleanTitle = cleanTitle.replace(/\bpass\b/gi, '').trim();
        }
        
        // Clean up any extra spaces or "System System" duplicates
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/System System/gi, 'System').trim();
        
        parsedFindings.push({
          title: cleanTitle,
          subtitle: neededPart ? `Needed: ${neededPart}` : undefined,
          status
        });
      });
  }

  addSectionTitle('Findings');
  if (parsedFindings.length > 0) {
    addListBadges(parsedFindings, statusColor);
  } else {
    drawCard(margin, contentWidth, 'Findings', 'No findings recorded', 50);
  }

  // Inspection results
  addSectionTitle('Inspection Results');
  if (visit.inspections && visit.inspections.length > 0) {
    const inspectionItems = visit.inspections.map((insp: any) => ({
      title: `${insp.category || ''} ${insp.item ? `- ${insp.item}` : ''}`.trim(),
      subtitle: insp.notes || '',
      status: insp.status
    }));
    addListBadges(inspectionItems, statusColor);
  } else {
    drawCard(margin, contentWidth, 'Inspection Results', 'No inspection data available', 50);
  }

  // Photos
  addSectionTitle('Evidence Photos & Videos');
  if (visit.photos && visit.photos.length > 0) {
    const thumbSize = 80;
    const gap = 10;
    const perRow = Math.max(1, Math.floor(contentWidth / (thumbSize + gap)));
    for (let i = 0; i < visit.photos.length; i++) {
      ensureSpace(thumbSize + 50);
      const photo = visit.photos[i];
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = margin + col * (thumbSize + gap);
      const rowY = y + row * (thumbSize + 50);

      // Card
      doc.setFillColor(theme.panelAlt);
      doc.setDrawColor(theme.border);
      const cardHeight = thumbSize + 30;
      doc.roundedRect(x, rowY, thumbSize, cardHeight, 8, 8, 'FD');

      const isVideo = photo.photo_url.toLowerCase().includes('.mp4') || 
                      photo.photo_url.toLowerCase().includes('.mov') || 
                      photo.photo_url.toLowerCase().includes('.webm');

      if (isVideo) {
        // Draw video placeholder
        doc.setFillColor(theme.panel);
        doc.roundedRect(x + 4, rowY + 4, thumbSize - 8, thumbSize - 8, 4, 4, 'F');
        doc.setTextColor(theme.muted);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const videoText = 'VIDEO';
        const textWidth = doc.getTextWidth(videoText);
        doc.text(videoText, x + (thumbSize - textWidth) / 2, rowY + thumbSize / 2 - 4);
      } else {
        // Try to load and display image
        const dataUrl = await toDataUrl(photo.photo_url);
        if (dataUrl) {
          try {
            // Determine image format from data URL
            let format = 'JPEG';
            if (dataUrl.startsWith('data:image/png')) format = 'PNG';
            else if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) format = 'JPEG';
            else if (dataUrl.startsWith('data:image/webp')) format = 'WEBP';
            
            doc.addImage(dataUrl, format, x + 4, rowY + 4, thumbSize - 8, thumbSize - 8);
          } catch (imgError) {
            console.warn('Error adding image to PDF:', imgError, photo.photo_url);
            // Draw placeholder on error
            doc.setFillColor(theme.panel);
            doc.roundedRect(x + 4, rowY + 4, thumbSize - 8, thumbSize - 8, 4, 4, 'F');
            doc.setTextColor(theme.muted);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            const errorText = 'Image';
            const textWidth = doc.getTextWidth(errorText);
            doc.text(errorText, x + (thumbSize - textWidth) / 2, rowY + thumbSize / 2);
          }
        } else {
          // Draw placeholder if image failed to load
          doc.setFillColor(theme.panel);
          doc.roundedRect(x + 4, rowY + 4, thumbSize - 8, thumbSize - 8, 4, 4, 'F');
          doc.setTextColor(theme.muted);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const errorText = 'Image';
          const textWidth = doc.getTextWidth(errorText);
          doc.text(errorText, x + (thumbSize - textWidth) / 2, rowY + thumbSize / 2);
        }
      }

      // Caption
      doc.setTextColor(theme.text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const caption = (photo.caption || (isVideo ? 'Video' : 'Photo')).substring(0, 25);
      doc.text(caption, x + 6, rowY + thumbSize + 12, {
        maxWidth: thumbSize - 12
      });

      if ((i + 1) % perRow === 0) {
        y = rowY + cardHeight + 8;
      }
    }
    const rows = Math.ceil((visit.photos.length || 1) / perRow);
    y += rows * (thumbSize + 50);
  } else {
    drawCard(margin, contentWidth, 'Photos', 'No evidence photos or videos uploaded for this visit.', 50);
  }

  // Footer
  ensureSpace(24);
  doc.setTextColor(theme.muted);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - margin + 6);

  return doc;
}

export async function generateVisitReportPdf(visit: VisitForPdf, fileName?: string) {
  const doc = await buildVisitReportDoc(visit);
  const finalName = fileName || `visit-${visit.visit_number}-report.pdf`;
  doc.save(finalName);
}

