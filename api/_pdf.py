import io
from datetime import datetime


def _generate_ride_pdf(ride: dict, user: dict) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as rl_canvas

    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=letter)
    w, h = letter

    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w / 2, h - inch, "DeisBikes")
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 1.4 * inch, "Brandeis University Bike Share")
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 2.2 * inch, "Ride Receipt")
    c.moveTo(50, h - 2.6 * inch)
    c.lineTo(w - 50, h - 2.6 * inch)
    c.stroke()

    y = h - 3 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Rider Information")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    c.drawString(inch, y, f"Name: {user.get('displayName', 'N/A')}")
    y -= 0.25 * inch
    c.drawString(inch, y, f"Email: {user.get('email', 'N/A')}")
    y -= 0.45 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Ride Details")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    for label, val in [
        ("Ride ID",    ride.get("rideId",    "N/A")),
        ("Bike ID",    ride.get("bikeId",    "N/A")),
        ("Start Time", str(ride.get("startTime", "N/A"))),
        ("End Time",   str(ride.get("endTime",   "N/A"))),
        ("Duration",   f"{ride.get('duration', 0)} minutes"),
    ]:
        c.drawString(inch, y, f"{label}: {val}")
        y -= 0.25 * inch

    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, inch, f"Generated on {datetime.utcnow().strftime('%B %d, %Y %I:%M %p')}")
    c.drawCentredString(w / 2, 0.75 * inch, "Thank you for using DeisBikes!")
    c.save()
    return buf.getvalue()


def _generate_history_pdf(rides: list, user: dict) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as rl_canvas

    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=letter)
    w, h = letter

    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w / 2, h - inch, "DeisBikes")
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 1.4 * inch, "Brandeis University Bike Share")
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 2.2 * inch, "Ride History Report")

    total_duration = sum(r.get("duration", 0) for r in rides)
    y = h - 3 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Summary")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    c.drawString(inch, y, f"Name: {user.get('displayName', 'N/A')}")
    y -= 0.25 * inch
    c.drawString(inch, y, f"Total Rides: {len(rides)}  |  Total Time: {total_duration} minutes")
    y -= 0.5 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Ride History")
    y -= 0.35 * inch

    for i, ride in enumerate(rides):
        if y < 1.5 * inch:
            c.showPage()
            y = h - inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(inch, y, f"Ride {i + 1}")
        y -= 0.25 * inch
        c.setFont("Helvetica", 11)
        c.drawString(inch, y,
                     f"  Bike: {ride.get('bikeId', 'N/A')} | "
                     f"Duration: {ride.get('duration', 0)} min | "
                     f"{str(ride.get('startTime', 'N/A'))[:19]}")
        y -= 0.35 * inch

    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, inch, f"Generated on {datetime.utcnow().strftime('%B %d, %Y %I:%M %p')}")
    c.save()
    return buf.getvalue()
