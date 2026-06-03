from datetime import date

import httpx
from icalendar import Calendar, Event


async def parse_remote_ical(url: str) -> list[tuple[date, date]]:
    """Fetch and parse an Airbnb/Booking.com iCal URL, return blocked date ranges."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    cal = Calendar.from_ical(resp.text)
    blocked: list[tuple[date, date]] = []
    for component in cal.walk():
        if component.name == "VEVENT":
            dtstart = component.get("DTSTART")
            dtend = component.get("DTEND")
            if dtstart and dtend:
                start = dtstart.dt if hasattr(dtstart.dt, "date") else dtstart.dt
                end = dtend.dt if hasattr(dtend.dt, "date") else dtend.dt
                blocked.append((start if isinstance(start, date) else start.date(), end if isinstance(end, date) else end.date()))
    return blocked


def generate_ical(property_uuid: str, bookings: list[dict]) -> bytes:
    """Generate iCal feed for a property — owner pastes into Airbnb."""
    cal = Calendar()
    cal.add("prodid", "-//StayNaivasha//EN")
    cal.add("version", "2.0")

    for b in bookings:
        event = Event()
        event.add("uid", f"{b['id']}@staynaivasha.co.ke")
        event.add("dtstart", b["check_in"])
        event.add("dtend", b["check_out"])
        event.add("summary", "Booked — StayNaivasha")
        cal.add_component(event)

    return cal.to_ical()
