import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export function downloadExamPDF(paper: any) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(paper.title.toUpperCase(), pageWidth - 40);
  doc.text(titleLines, pageWidth / 2, 20, { align: 'center' });

  let currentY = 20 + (titleLines.length * 8);

  // Exam Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Time: ${Math.floor(paper.duration / 60)} hrs ${paper.duration % 60} mins`, 20, currentY);
  doc.text(`Full Marks: ${paper.total_marks}`, pageWidth - 20, currentY, { align: 'right' });

  currentY += 10;
  doc.line(20, currentY, pageWidth - 20, currentY);
  currentY += 15;

  // Sections
  paper.sections.forEach((section: any) => {
    // Check page overflow
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(section.title.toUpperCase(), 20, currentY);
    doc.text(`[${section.questions.length} x ${section.marks_per_question} = ${section.questions.length * section.marks_per_question}]`, pageWidth - 20, currentY, { align: 'right' });

    currentY += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    section.questions.forEach((q: string, idx: number) => {
      const qText = `${idx + 1}. ${q}`;
      const lines = doc.splitTextToSize(qText, pageWidth - 40);

      if (currentY + (lines.length * 6) > 280) {
        doc.addPage();
        currentY = 20;
      }

      doc.text(lines, 20, currentY);
      currentY += (lines.length * 7);
    });

    currentY += 10;
  });

  doc.save(`${paper.title.replace(/\s+/g, '_')}.pdf`);
}
