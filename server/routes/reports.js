import express from 'express';
import PDFDocument from 'pdfkit';
import { ensureAuthenticated } from '../middleware/auth.js';
import { rideHistory } from './rides.js';

const router = express.Router();

// Generate PDF report for a single ride
router.get('/ride/:rideId/pdf', ensureAuthenticated, (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;

  const userRides = rideHistory.get(userId) || [];
  const ride = userRides.find(r => r.rideId === rideId);

  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  // Create PDF document
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ride-${rideId}.pdf`);

  // Pipe PDF directly to response (stateless)
  doc.pipe(res);

  // Generate PDF content
  generateRidePDF(doc, ride, req.user);

  doc.end();
});

// Generate PDF report for all user rides
router.get('/history/pdf', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  const userRides = rideHistory.get(userId) || [];

  if (userRides.length === 0) {
    return res.status(404).json({ error: 'No rides found' });
  }

  // Create PDF document
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ride-history-${Date.now()}.pdf`);

  // Pipe PDF directly to response (stateless)
  doc.pipe(res);

  // Generate PDF content
  generateHistoryPDF(doc, userRides, req.user);

  doc.end();
});

// Generate summary report (JSON)
router.get('/summary', ensureAuthenticated, (req, res) => {
  const userId = req.user.id;
  const userRides = rideHistory.get(userId) || [];

  const totalRides = userRides.length;
  const totalDuration = userRides.reduce((sum, ride) => sum + (ride.duration || 0), 0);
  const avgDuration = totalRides > 0 ? Math.round(totalDuration / totalRides) : 0;

  res.json({
    totalRides,
    totalDuration,
    averageDuration: avgDuration,
    firstRide: userRides.length > 0 ? userRides[userRides.length - 1].startTime : null,
    lastRide: userRides.length > 0 ? userRides[0].startTime : null
  });
});

// Helper function to generate single ride PDF
function generateRidePDF(doc, ride, user) {
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('DeisBikes', { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Brandeis University Bike Share', { align: 'center' });
  doc.moveDown(2);

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text('Ride Receipt', { align: 'center' });
  doc.moveDown();

  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // User info
  doc.fontSize(12).font('Helvetica-Bold').text('Rider Information');
  doc.font('Helvetica')
    .text(`Name: ${user.displayName}`)
    .text(`Email: ${user.email}`);
  doc.moveDown();

  // Ride details
  doc.fontSize(12).font('Helvetica-Bold').text('Ride Details');
  doc.font('Helvetica')
    .text(`Ride ID: ${ride.rideId}`)
    .text(`Bike ID: ${ride.bikeId}`)
    .text(`Start Time: ${formatDate(ride.startTime)}`)
    .text(`End Time: ${formatDate(ride.endTime)}`)
    .text(`Duration: ${ride.duration} minutes`);
  doc.moveDown(2);

  // Footer
  doc.fontSize(10).text(`Generated on ${formatDate(new Date())}`, { align: 'center' });
  doc.text('Thank you for using DeisBikes!', { align: 'center' });
}

// Helper function to generate ride history PDF
function generateHistoryPDF(doc, rides, user) {
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('DeisBikes', { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Brandeis University Bike Share', { align: 'center' });
  doc.moveDown(2);

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text('Ride History Report', { align: 'center' });
  doc.moveDown();

  // User info
  doc.fontSize(12).font('Helvetica-Bold').text('Rider Information');
  doc.font('Helvetica')
    .text(`Name: ${user.displayName}`)
    .text(`Email: ${user.email}`);
  doc.moveDown();

  // Summary
  const totalDuration = rides.reduce((sum, r) => sum + (r.duration || 0), 0);
  doc.font('Helvetica-Bold').text('Summary');
  doc.font('Helvetica')
    .text(`Total Rides: ${rides.length}`)
    .text(`Total Time: ${totalDuration} minutes`);
  doc.moveDown();

  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Ride list
  doc.fontSize(12).font('Helvetica-Bold').text('Ride History');
  doc.moveDown(0.5);

  rides.forEach((ride, index) => {
    // Check if we need a new page
    if (doc.y > 700) {
      doc.addPage();
    }

    doc.font('Helvetica-Bold').text(`Ride ${index + 1}`, { continued: true });
    doc.font('Helvetica').text(` - ${formatDate(ride.startTime)}`);
    doc.text(`  Bike: ${ride.bikeId} | Duration: ${ride.duration || 0} minutes`);
    doc.moveDown(0.5);
  });

  doc.moveDown(2);

  // Footer
  doc.fontSize(10).text(`Generated on ${formatDate(new Date())}`, { align: 'center' });
}

// Format date helper
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export default router;
