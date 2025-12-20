POST http://localhost:3000/events
Content-Type: application/json

{
  "eventId": "3537ef6d-1f8e-44a3-beac-3c1c6d6a47f7",
  "companyId": "acme_corp",
  "entityId": "vehicle_44",
  "type": "ACCIDENT",
  "source": "mobile",
  "payload": {
    "location": {
      "lat": 41.3111,
      "lng": 69.2797
    },
    "severity": "minor",
    "description": "Rear bumper damage"
  },
  "occurredAt": "2025-12-18T14:32:10Z"
}

HTTP 200

